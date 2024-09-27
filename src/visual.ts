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

        this.drawNetwork(nodes, links, 100, -200);
    }


    private drawNetwork(nodes: NodeDatum[], links: LinkDatum[], linkDistance: number, chargeStrength: number) {
        this.container.selectAll('*').remove();

        // Aggiungi un marker per le frecce
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

        const simulation = d3.forceSimulation<NodeDatum>(nodes)
            .force('link', d3.forceLink<NodeDatum, LinkDatum>(links).id(d => d.id).distance(linkDistance))
            .force('charge', d3.forceManyBody().strength(chargeStrength))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2));

        const link = this.container.append('g')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 2)
            .attr('marker-end', 'url(#arrowhead)');

        const node = this.container.append('g').selectAll('g')
            .data(nodes).enter().append('g')
            .call(d3.drag<SVGGElement, NodeDatum>().on('start', dragstarted).on('drag', dragged).on('end', dragended));

        // Aggiungiamo un fattore di scala per ingrandire i nodi
        const scaleFactor = 2; // Incrementa la dimensione del nodo, puoi regolare il valore
        node.append('circle').attr('r', d => d.size * scaleFactor)  // Ingrandisci i nodi mantenendo la proporzionalità.attr('fill', d => d.color);

        // Aggiunge il testo centrato nel cerchio con contrasto automatico
        node.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('font-size', d => Math.min((d.size * scaleFactor) / 2, 12)).attr('fill', d => getContrastColor(d.color)).text(d => d.id);
        // Calcola il contrasto migliore tra bianco e nero
        function getContrastColor(hexColor: string): string {
            // Converti il colore esadecimale in RGB
            const rgb = parseInt(hexColor.substring(1), 16); // Rimuove il # e converte in numerico
            const r = (rgb >> 16) & 0xff;
            const g = (rgb >> 8) & 0xff;
            const b = rgb & 0xff;
            // Calcola la luminosità percepita
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            // Se la luminosità è alta, usa il nero come colore del testo, altrimenti bianco
            return luminance > 128 ? '#000000' : '#ffffff';
        }

        // Aggiunge il testo per i link
        const linkText = this.container.append('g')
            .selectAll('text')
            .data(links)
            .enter().append('text')
            .attr('font-size', '10px')
            .attr('text-anchor', 'middle')
            .text(d => d.text);

        simulation.on('tick', () => {
            link
                .attr('x1', d => adjustLinkEnd(d.source as NodeDatum, d.target as NodeDatum, true))  // Adjusted x1
                .attr('y1', d => adjustLinkEnd(d.source as NodeDatum, d.target as NodeDatum, false)) // Adjusted y1
                .attr('x2', d => adjustLinkEnd(d.target as NodeDatum, d.source as NodeDatum, true))  // Adjusted x2
                .attr('y2', d => adjustLinkEnd(d.target as NodeDatum, d.source as NodeDatum, false)); // Adjusted y2

            node
                .attr('transform', d => `translate(${d.x}, ${d.y})`);

            // Allinea il testo dei link
            linkText
                .attr('x', d => ((d.source as NodeDatum).x + (d.target as NodeDatum).x) / 2)
                .attr('y', d => ((d.source as NodeDatum).y + (d.target as NodeDatum).y) / 2)
                .attr('dy', -5) // Sposta il testo un po' sopra la linea
                .attr('transform', d => {
                    const x1 = (d.source as NodeDatum).x;
                    const y1 = (d.source as NodeDatum).y;
                    const x2 = (d.target as NodeDatum).x;
                    const y2 = (d.target as NodeDatum).y;
                    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI; // Calcola l'angolo in gradi
                    return `rotate(${angle}, ${((x1 + x2) / 2)}, ${((y1 + y2) / 2)})`; // Ruota il testo per allinearlo
                });
        });

        // Funzione per evitare che la freccia finisca dentro il cerchio
        function adjustLinkEnd(source: NodeDatum, target: NodeDatum, isX: boolean): number {
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const ratio = (distance - (source.size * scaleFactor)) / distance;  // Adjust the link based on the node size
            return isX ? source.x + dx * ratio : source.y + dy * ratio;
        }

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