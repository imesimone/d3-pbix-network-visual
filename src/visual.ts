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

            // Colonna separata per il colore e la dimensione (peso) dei nodi
            const sourceNodeColor = row[3] ? row[3].toString() : '#1E88E5';  // Colore del nodo sorgente
            const sourceNodeSizeStr = row[4] ? row[4].toString() : 'M';      // Dimensione del nodo sorgente
            const targetNodeColor = row[5] ? row[5].toString() : '#1E88E5';  // Colore del nodo target
            const targetNodeSizeStr = row[6] ? row[6].toString() : 'M';      // Dimensione del nodo target

            let sourceNodeSize: number;
            let targetNodeSize: number;

            // Conversione delle dimensioni in numeri
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


    private drawNetwork(nodes: NodeDatum[], links: LinkDatum[]) {
        this.container.selectAll('*').remove();

        // Modifica le forze per aumentare la distanza tra i nodi
        const simulation = d3.forceSimulation<NodeDatum>(nodes)
            .force('link', d3.forceLink<NodeDatum, LinkDatum>(links).id(d => d.id).distance(100)) // Aumenta la distanza dei link
            .force('charge', d3.forceManyBody().strength(-200)) // Aumenta la forza di carica per maggiore separazione
            .force('center', d3.forceCenter(this.width / 2, this.height / 2));

        const link = this.container.append('g')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 2);

        const node = this.container.append('g')
            .selectAll('g')
            .data(nodes)
            .enter().append('g')  // Crea un gruppo per ciascun nodo
            .call(d3.drag<SVGGElement, NodeDatum>()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        // Aggiunge un cerchio per il nodo
        node.append('circle')
            .attr('r', d => d.size)
            .attr('fill', d => d.color);

        // Aggiunge il testo centrato nel cerchio
        node.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle') // Centra verticalmente il testo
            .attr('font-size', d => Math.min(d.size / 2, 12)) // Regola la dimensione del testo in base alla dimensione del cerchio
            .text(d => d.id);

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
                .attr('transform', d => `translate(${d.x}, ${d.y})`); // Posiziona il gruppo del nodo

            linkText
                .attr('x', d => ((d.source as NodeDatum).x + (d.target as NodeDatum).x) / 2)
                .attr('y', d => ((d.source as NodeDatum).y + (d.target as NodeDatum).y) / 2);

            nodeText
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        function dragstarted(event: d3.D3DragEvent<SVGGElement, NodeDatum, NodeDatum>, d: NodeDatum) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event: d3.D3DragEvent<SVGGElement, NodeDatum, NodeDatum>, d: NodeDatum) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event: d3.D3DragEvent<SVGGElement, NodeDatum, NodeDatum>, d: NodeDatum) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
    }
}