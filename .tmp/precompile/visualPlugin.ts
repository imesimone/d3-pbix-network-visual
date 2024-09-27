import { Visual } from "../../src/visual";
import powerbiVisualsApi from "powerbi-visuals-api";
import IVisualPlugin = powerbiVisualsApi.visuals.plugins.IVisualPlugin;
import VisualConstructorOptions = powerbiVisualsApi.extensibility.visual.VisualConstructorOptions;
import DialogConstructorOptions = powerbiVisualsApi.extensibility.visual.DialogConstructorOptions;
var powerbiKey: any = "powerbi";
var powerbi: any = window[powerbiKey];
var d3NetworkGraph23EC7E7E9122435193E1ED78291D459F: IVisualPlugin = {
    name: 'd3NetworkGraph23EC7E7E9122435193E1ED78291D459F',
    displayName: 'D3.js Network Graph',
    class: 'Visual',
    apiVersion: '5.1.0',
    create: (options?: VisualConstructorOptions) => {
        if (Visual) {
            return new Visual(options);
        }
        throw 'Visual instance not found';
    },
    createModalDialog: (dialogId: string, options: DialogConstructorOptions, initialState: object) => {
        const dialogRegistry = (<any>globalThis).dialogRegistry;
        if (dialogId in dialogRegistry) {
            new dialogRegistry[dialogId](options, initialState);
        }
    },
    custom: true
};
if (typeof powerbi !== "undefined") {
    powerbi.visuals = powerbi.visuals || {};
    powerbi.visuals.plugins = powerbi.visuals.plugins || {};
    powerbi.visuals.plugins["d3NetworkGraph23EC7E7E9122435193E1ED78291D459F"] = d3NetworkGraph23EC7E7E9122435193E1ED78291D459F;
}
export default d3NetworkGraph23EC7E7E9122435193E1ED78291D459F;