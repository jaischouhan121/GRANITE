import React, { useState } from 'react';

// Make TypeScript aware of the global XLSX object from the script tag
declare const XLSX: any;

interface BackupRestoreProps {
    onBackup: () => void;
    onRestore: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onImport: (type: string, data: any[]) => void;
}

const BackupRestore: React.FC<BackupRestoreProps> = ({ onBackup, onRestore, onImport }) => {
    const [importType, setImportType] = useState<'block' | 'rough' | 'polish' | ''>('');

    const handleDownloadTemplate = (type: 'block' | 'rough' | 'polish') => {
        let headers: string[] = [];
        let filename = '';

        if (type === 'block') {
            filename = 'template-block-stock.xlsx';
            headers = [
                'invoice_no', 'invoice_date', 'party_name', 'color_name', 'length_cm', 'height_cm', 'width_cm',
                'block_mines_no', 'block_no', 'inward_date', 'weight_ton', 'royalty_rate_per_ton', 'transport_rate_per_ton',
                'block_rate_per_ton', 'cubic_m', 'royalty_amount', 'transport_amount', 'block_total_amount'
            ];
        } else if (type === 'rough') {
            filename = 'template-rough-stock.xlsx';
            headers = [
                'block_no', 'color_name', 'original_cbm', 'cutting_date', 'cut_length_ft', 
                'cut_height_ft', 'pcs', 'thickness_mm'
            ];
        } else if (type === 'polish') {
            filename = 'template-polish-stock.xlsx';
            headers = [
                'block_no', 'color_name', 'cutting_date', 'polish_date', 'polish_length_ft', 
                'polish_height_ft', 'pcs', 'thickness_mm'
            ];
        }

        const ws = XLSX.utils.json_to_sheet([], { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data');
        XLSX.writeFile(wb, filename);
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        if (!importType) {
            alert("Please select the type of data you are importing first.");
            event.target.value = ''; // Reset file input
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                onImport(importType, json);
            } catch (error: any) {
                alert(`Error processing file: ${error.message}`);
            } finally {
                event.target.value = ''; // Reset file input
            }
        };
        reader.readAsBinaryString(file);
    };


    return (
        <div className="bg-secondary p-8 rounded-lg shadow-lg space-y-8">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Data Management</h2>
            
            <div className="border-t border-accent pt-6">
                <h3 className="text-lg font-medium text-text-primary">Create Backup</h3>
                <p className="text-sm text-highlight mt-1 mb-4">
                    Download all your current data into a single JSON file. Keep this file in a safe place.
                </p>
                <button
                    onClick={onBackup}
                    className="px-6 py-2 bg-brand text-white font-semibold rounded-md shadow-md hover:bg-teal-500"
                >
                    Create Backup File
                </button>
            </div>

            <div className="border-t border-accent pt-6">
                <h3 className="text-lg font-medium text-text-primary">Restore from Backup</h3>
                 <div className="p-4 border-2 border-dashed border-red-500/50 bg-red-900/20 rounded-md mb-4">
                     <p className="text-sm font-bold text-red-300">
                        Warning: Restoring from a backup will completely overwrite all existing data. This action cannot be undone.
                     </p>
                </div>
                <div>
                    <label 
                        htmlFor="restore-file-input"
                        className="cursor-pointer px-6 py-2 bg-accent text-white font-semibold rounded-md shadow-md hover:bg-gray-600 inline-block"
                    >
                        Select Restore File (.json)
                    </label>
                    <input
                        id="restore-file-input"
                        type="file"
                        accept=".json"
                        onChange={onRestore}
                        className="hidden"
                    />
                </div>
            </div>
            
            <div className="border-t border-accent pt-6">
                <h3 className="text-lg font-medium text-text-primary">Import from Template</h3>
                <p className="text-sm text-highlight mt-1 mb-4">
                    Import historical data from an Excel file. This will ADD data to your existing records, not overwrite it.
                </p>
                
                <div className="space-y-4">
                    <div>
                        <p className="text-sm font-medium text-highlight mb-2">1. Download Template</p>
                        <div className="flex flex-wrap gap-2">
                             <button onClick={() => handleDownloadTemplate('block')} className="px-4 py-2 text-sm bg-accent text-white font-semibold rounded-md hover:bg-gray-600">Block Stock</button>
                             <button onClick={() => handleDownloadTemplate('rough')} className="px-4 py-2 text-sm bg-accent text-white font-semibold rounded-md hover:bg-gray-600">Rough Stock</button>
                             <button onClick={() => handleDownloadTemplate('polish')} className="px-4 py-2 text-sm bg-accent text-white font-semibold rounded-md hover:bg-gray-600">Polish Stock</button>
                        </div>
                    </div>
                    
                    <div>
                        <p className="text-sm font-medium text-highlight mb-2">2. Select Import Type</p>
                         <select
                            value={importType}
                            onChange={(e) => setImportType(e.target.value as any)}
                            className="block w-full md:w-1/2 bg-accent border-gray-600 rounded-md shadow-sm p-2"
                        >
                            <option value="">-- Select data type to import --</option>
                            <option value="block">Block Stock (Pending Blocks)</option>
                            <option value="rough">Rough Stock (Cut Slabs)</option>
                            <option value="polish">Polish Stock (Finished Slabs)</option>
                        </select>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-highlight mb-2">3. Upload Filled Template</p>
                        <label 
                            htmlFor="import-file-input"
                            className={`cursor-pointer px-6 py-2 font-semibold rounded-md shadow-md inline-block ${!importType ? 'bg-gray-500 text-gray-300 cursor-not-allowed' : 'bg-brand text-white hover:bg-teal-500'}`}
                        >
                            Select Import File (.xlsx)
                        </label>
                        <input
                            id="import-file-input"
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileImport}
                            className="hidden"
                            disabled={!importType}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BackupRestore;