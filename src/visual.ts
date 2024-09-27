import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataView = powerbi.DataView;

interface NodeDatum extends d3.SimulationNodeDatum {
    id: string;
    color: string;
    size: number;
}

interface LinkDatum extends d3.SimulationLinkDatum<NodeDatum> {
    text: string;
}

interface NetworkSettings {
    linkDistance: number;
    chargeStrength: number;
}

export class Visual implements IVisual {
    private host: powerbi.extensibility.visual.IVisualHost;
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private container: d3.Selection<SVGGElement, unknown, null, undefined>;
    private width: number;
    private height: number;
    private settings: NetworkSettings;
    private simulation: d3.Simulation<NodeDatum, LinkDatum>;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.svg = d3.select(options.element)
            .append('svg')
            .classed('network-graph', true);
        this.container = this.svg.append('g');
        this.settings = {
            linkDistance: 100,
            chargeStrength: -200
        };
    }

    public update(options: VisualUpdateOptions) {
        const dataView: DataView = options.dataViews[0];
        const tableView = dataView.table;

        if (!tableView) return;

        this.width = options.viewport.width;
        this.height = options.viewport.height;
        this.svg.attr('width', this.width).attr('height', this.height);

        // Update settings from dataView
        this.updateSettings(dataView);

        const nodes: NodeDatum[] = [];
        const links: LinkDatum[] = [];
        const nodeMap = new Map<string, NodeDatum>();

        tableView.rows.forEach(row => {
            const source = row[0].toString();
            const target = row[1].toString();
            const linkText = row[2] ? row[2].toString() : '';
            const sourceNodeColor = row[3] ? row[3].toString() : '#1E88E5';
            const sourceNodeSizeStr = row[4] ? row[4].toString() : 'M';
            const targetNodeColor = row[5] ? row[5].toString() : '#1E88E5';
            const targetNodeSizeStr = row[6] ? row[6].toString() : 'M';

            let sourceNodeSize: number;
            let targetNodeSize: number;

            switch (sourceNodeSizeStr) {
                case 'P': sourceNodeSize = 5; break;
                case 'M': sourceNodeSize = 10; break;
                case 'G': sourceNodeSize = 15; break;
                case 'MG': sourceNodeSize = 20; break;
                default: sourceNodeSize = 10; break;
            }

            switch (targetNodeSizeStr) {
                case 'P': targetNodeSize = 5; break;
                case 'M': targetNodeSize = 10; break;
                case 'G': targetNodeSize = 15; break;
                case 'MG': targetNodeSize = 20; break;
                default: targetNodeSize = 10; break;
            }

            if (!nodeMap.has(source)) {
                const sourceNode: NodeDatum = { id: source, color: sourceNodeColor, size: sourceNodeSize };
                nodeMap.set(source, sourceNode);
                nodes.push(sourceNode);
            }
            if (!nodeMap.has(target)) {
                const targetNode: NodeDatum = { id: target, color: targetNodeColor, size: targetNodeSize };
                nodeMap.set(target, targetNode);
                nodes.push(targetNode);
            }

            links.push({ source: nodeMap.get(source), target: nodeMap.get(target), text: linkText });
        });

        this.drawNetwork(nodes, links);
    }

    private updateSettings(dataView: DataView) {
        if (dataView.metadata && dataView.metadata.objects) {
            const networkSettings = dataView.metadata.objects['networkSettings'];
            if (networkSettings) {
                this.settings.linkDistance = networkSettings['linkDistance'] as number ?? this.settings.linkDistance;
                this.settings.chargeStrength = networkSettings['chargeStrength'] as number ?? this.settings.chargeStrength;
            }
        }
    }

    private getContrastColor(hexColor: string): string {
        const rgb = parseInt(hexColor.substring(1), 16);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = rgb & 0xff;
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        return luminance > 128 ? '#000000' : '#ffffff';
    }

    private drawNetwork(nodes: NodeDatum[], links: LinkDatum[]) {
        this.container.selectAll('*').remove();

        this.svg.append('defs').append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '0 0 10 10')
            .attr('refX', 10)
            .attr('refY', 5)
            .attr('orient', 'auto')
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .append('polygon')
            .attr('points', '0 0, 10 5, 0 10')
            .attr('fill', '#999');

        this.simulation = d3.forceSimulation<NodeDatum>(nodes)
            .force('link', d3.forceLink<NodeDatum, LinkDatum>(links).id(d => d.id).distance(this.settings.linkDistance))
            .force('charge', d3.forceManyBody().strength(this.settings.chargeStrength))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2));

        const link = this.container.append('g')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 2)
            .attr('marker-end', 'url(#arrowhead)');

        const node = this.container.append('g')
            .selectAll('g')
            .data(nodes)
            .enter().append('g')
            .call(d3.drag<SVGGElement, NodeDatum>()
                .on('start', (event, d) => this.dragstarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragended(event, d)));

        const scaleFactor = 2;
        node.append('circle')
            .attr('r', d => d.size * scaleFactor)
            .attr('fill', d => d.color);

        node.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', d => Math.min((d.size * scaleFactor) / 2, 12))
            .attr('fill', d => this.getContrastColor(d.color))
            .text(d => d.id);

        const linkText = this.container.append('g')
            .selectAll('text')
            .data(links)
            .enter().append('text')
            .attr('font-size', '10px')
            .attr('text-anchor', 'middle')
            .text(d => d.text);

        this.simulation.on('tick', () => {
            node.attr('transform', d => `translate(${d.x}, ${d.y})`);

            linkText
                .attr('x', d => ((d.source as NodeDatum).x + (d.target as NodeDatum).x) / 2)
                .attr('y', d => ((d.source as NodeDatum).y + (d.target as NodeDatum).y) / 2)
                .attr('dy', -5)
                .attr('transform', d => {
                    const x1 = (d.source as NodeDatum).x;
                    const y1 = (d.source as NodeDatum).y;
                    const x2 = (d.target as NodeDatum).x;
                    const y2 = (d.target as NodeDatum).y;
                    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
                    return `rotate(${angle}, ${((x1 + x2) / 2)}, ${((y1 + y2) / 2)})`;
                });

            link.each((d, i, nodes) => {
                const sourceNode = d.source as NodeDatum;
                const targetNode = d.target as NodeDatum;
                const dx = targetNode.x - sourceNode.x;
                const dy = targetNode.y - sourceNode.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const sourceRadius = sourceNode.size * scaleFactor;
                const targetRadius = targetNode.size * scaleFactor;

                const sourceRatio = sourceRadius / distance;
                const targetRatio = (distance - targetRadius) / distance;

                d3.select(nodes[i])
                    .attr('x1', sourceNode.x + dx * sourceRatio)
                    .attr('y1', sourceNode.y + dy * sourceRatio)
                    .attr('x2', sourceNode.x + dx * targetRatio)
                    .attr('y2', sourceNode.y + dy * targetRatio);
            });
        });
    }

    private dragstarted(event: d3.D3DragEvent<SVGGElement, NodeDatum, NodeDatum>, d: NodeDatum) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    private dragged(event: d3.D3DragEvent<SVGGElement, NodeDatum, NodeDatum>, d: NodeDatum) {
        d.fx = event.x;
        d.fy = event.y;
    }

    private dragended(event: d3.D3DragEvent<SVGGElement, NodeDatum, NodeDatum>, d: NodeDatum) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}