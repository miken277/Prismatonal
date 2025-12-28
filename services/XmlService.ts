import { StoreState } from '../types';

export class XmlService {
    
    static exportState(state: StoreState): string {
        const { settings, presets, userBank } = state;
        
        // Wrap large data structures in CDATA for safe XML inclusion of JSON
        // Ensure all critical data (Settings including Chords/Arps, Presets, UserBank) is captured.
        const settingsJson = JSON.stringify(settings);
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
                        partialState.settings = JSON.parse(settingsNode.textContent);
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
