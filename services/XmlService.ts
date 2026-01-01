
import { StoreState } from '../types';

export class XmlService {
    
    static exportState(state: StoreState): string {
        const { settings, presets, userBank } = state;
        
        // Clone settings to strip heavy background data
        const settingsForExport = { ...settings };
        
        // Exclude background presets and active background image data from export
        // to keep file size manageable and allow for separate distribution of assets.
        settingsForExport.backgroundPresets = [];
        settingsForExport.backgroundImageData = null;
        
        // Wrap large data structures in CDATA for safe XML inclusion of JSON
        const settingsJson = JSON.stringify(settingsForExport);
        const presetsJson = JSON.stringify(presets);
        const userBankJson = JSON.stringify(userBank);

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PrismaTonalData version="1.1">
    <Description>PrismaTonal Configuration Snapshot - Full State</Description>
    <Settings><![CDATA[${settingsJson}]]></Settings>
    <ActivePresets><![CDATA[${presetsJson}]]></ActivePresets>
    <UserBank><![CDATA[${userBankJson}]]></UserBank>
</PrismaTonalData>`;

        return xml;
    }

    static async parseImport(file: File): Promise<Partial<StoreState> | null> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result as string;
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(text, "text/xml");
                    
                    if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
                        reject(new Error("Invalid XML File"));
                        return;
                    }

                    const settingsNode = xmlDoc.getElementsByTagName("Settings")[0];
                    const presetsNode = xmlDoc.getElementsByTagName("ActivePresets")[0];
                    const userBankNode = xmlDoc.getElementsByTagName("UserBank")[0];
                    
                    const partialState: Partial<StoreState> = {};

                    if (settingsNode && settingsNode.textContent) {
                        const parsedSettings = JSON.parse(settingsNode.textContent);
                        // If imported settings have empty backgrounds (due to export logic), 
                        // we might want to preserve existing ones or handle it gracefully.
                        // For now, we assume import overrides settings logic handled in Store.ts migration.
                        partialState.settings = parsedSettings;
                    }

                    if (presetsNode && presetsNode.textContent) {
                        partialState.presets = JSON.parse(presetsNode.textContent);
                    }

                    if (userBankNode && userBankNode.textContent) {
                        partialState.userBank = JSON.parse(userBankNode.textContent);
                    }

                    resolve(partialState);

                } catch (err) {
                    console.error("Failed to parse PrismaTonal XML", err);
                    reject(err);
                }
            };
            reader.readAsText(file);
        });
    }

    static generateFilename(): string {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-').slice(0, 5);
        return `PrismaTonal_Backup_${dateStr}_${timeStr}.xml`;
    }

    static downloadFile(xmlContent: string, filename?: string) {
        const name = filename || this.generateFilename();
        const blob = new Blob([xmlContent], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
