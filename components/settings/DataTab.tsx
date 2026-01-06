import React, { useRef } from 'react';
import { useStore } from '../../services/Store';

interface Props {
    onClose: () => void;
}

const DataTab: React.FC<Props> = ({ onClose }) => {
    const { exportXML, importXML } = useStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const confirmed = window.confirm(
                "WARNING: Importing will overwrite ALL system settings, keyboard mappings, user bank patches, and currently selected synth sounds.\n\n" +
                "This action cannot be undone.\n\n" +
                "Do you wish to proceed?"
            );
            
            if (confirmed) {
                importXML(file).then(success => { 
                    if (success) onClose(); 
                });
            }
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="space-y-6">
                <h3 className="font-semibold text-orange-400 border-b border-slate-700 pb-1">Backup & Restore</h3>
                <p className="text-sm text-slate-400">Manage your entire PrismaTonal configuration in a single XML file.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 flex flex-col items-center text-center">
                        <h4 className="font-bold text-white mb-2">Export Full Data</h4>
                        <button onClick={exportXML} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded transition">Export to XML</button>
                    </div>
                    <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 flex flex-col items-center text-center">
                        <h4 className="font-bold text-white mb-2">Import Full Data</h4>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".xml" onChange={handleFileChange} />
                        <button onClick={handleImportClick} className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded transition">Import from XML</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataTab;
