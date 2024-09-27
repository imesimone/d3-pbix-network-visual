import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataView = powerbi.DataView;
import * as d3 from "d3";

interface NodeDatum extends d3.SimulationNodeDatum {
    id: string;
    color: string;
    size: number;
}

interface LinkDatum extends d3.SimulationLinkDatum<NodeDatum> {
    text: string;
}

export class Visual implements IVisual {
    private host: powerbi.extensibility.visual.IVisualHost;
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private container: d3.Selection<SVGGElement, unknown, null, undefined>;
    private width: number;
    private height: number;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.svg = d3.select(options.element)
            .append('svg')
            .classed('network-graph', true);
        this.container = this.svg.append('g');

        // Definire la freccia come marker
        this.svg.append("defs").append("marker")
            .attr("id", "arrow")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 10)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#999");
    }

    public update(options: VisualUpdateOptions) {
        const dataView: DataView = options.dataViews[0];
        const tableView = dataView.table;

        if (!tableView) return;

        this.width = options.viewport.width;
        this.height = options.viewport.height;
        this.svg.attr('width', this.width).attr('height', this.height);

        const nodes: NodeDatum[] = [];
        const links: LinkDatum[] = [];
        const nodeMap = new Map<string, NodeDatum>();

        tableView.rows.forEach(row => {
            const source = row[0].toString();
            const target = row[1].toString();
            const linkText = row[2] ? row[2].toString() : '';
            const nodeColor = row[3] ? row[3].toString() : '#1E88E5';
            const nodeSizeStr = row[4] ? row[4].toString() : 'M'; // Manteniamo nodeSize come stringa

            // Variabile separata per mappare la stringa a un numero
            let nodeSize: number;
            switch (nodeSizeStr) {
                case 'P': nodeSize = 5; break;
                case 'M': nodeSize = 10; break;
                case 'G': nodeSize = 15; break;
                case 'MG': nodeSize = 20; break;
                default: nodeSize = 10; break;
            }

            if (!nodeMap.has(source)) {
                const sourceNode: NodeDatum = { id: source, color: nodeColor, size: nodeSize };
                nodeMap.set(source, sourceNode);
                nodes.push(sourceNode);
            }
            if (!nodeMap.has(target)) {
                const targetNode: NodeDatum = { id: target, color: nodeColor, size: nodeSize };
                nodeMap.set(target, targetNode);
                nodes.push(targetNode);
            }

            links.push({ source: nodeMap.get(source), target: nodeMap.get(target), text: linkText });
        });

        this.drawNetwork(nodes, links);
    }

    private drawNetwork(nodes: NodeDatum[], links: LinkDatum[]) {
        this.container.selectAll('*').remove();

        const simulation = d3.forceSimulation<NodeDatum>(nodes)
            .force('link', d3.forceLink<NodeDatum, LinkDatum>(links).id(d => d.id))
            .force('charge', d3.forceManyBody().strength(-100))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2));

        const link = this.container.append('g')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 2)
            .attr("marker-end", "url(#arrow)"); // Aggiungi freccia alla fine della linea

        const node = this.container.append('g')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('r', d => d.size)
            .attr('fill', d => d.color)
            .call(d3.drag<SVGCircleElement, NodeDatum>()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        const linkText = this.container.append('g')
            .selectAll('text')
            .data(links)
            .enter().append('text')
            .attr('font-size', '10px')
            .attr('text-anchor', 'middle')
            .text(d => d.text);

        const nodeText = this.container.append('g')
            .selectAll('text')
            .data(nodes)
            .enter().append('text')
            .attr('font-size', '10px')
            .attr('dx', 12)
            .attr('dy', 4)
            .text(d => d.id);

        simulation.on('tick', () => {
            link
                .attr('x1', d => (d.source as NodeDatum).x)
                .attr('y1', d => (d.source as NodeDatum).y)
                .attr('x2', d => (d.target as NodeDatum).x)
                .attr('y2', d => (d.target as NodeDatum).y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            // Allineamento del testo alle frecce
            linkText
                .attr('x', d => ((d.source as NodeDatum).x + (d.target as NodeDatum).x) / 2)
                .attr('y', d => ((d.source as NodeDatum).y + (d.target as NodeDatum).y) / 2)
                .attr('transform', d => {
                    const angle = Math.atan2(
                        (d.target as NodeDatum).y - (d.source as NodeDatum).y,
                        (d.target as NodeDatum).x - (d.source as NodeDatum).x
                    ) * 180 / Math.PI;
                    return `rotate(${angle}, ${((d.source as NodeDatum).x + (d.target as NodeDatum).x) / 2}, ${((d.source as NodeDatum).y + (d.target as NodeDatum).y) / 2})`;
                });

            nodeText
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        function dragstarted(event: d3.D3DragEvent<SVGCircleElement, NodeDatum, NodeDatum>, d: NodeDatum) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event: d3.D3DragEvent<SVGCircleElement, NodeDatum, NodeDatum>, d: NodeDatum) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event: d3.D3DragEvent<SVGCircleElement, NodeDatum, NodeDatum>, d: NodeDatum) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
    }
}