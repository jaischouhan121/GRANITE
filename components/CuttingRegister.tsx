import React, { useState, useEffect } from 'react';
import { Block, CuttingEntry } from '../types';

interface CuttingRegisterProps {
    blocks: Block[];
    cuttingHistory: CuttingEntry[];
    onSave: (entryData: Omit<CuttingEntry, 'id'>, newBlockStatus: 'Partial' | 'OK') => void;
}

const CuttingRegister: React.FC<CuttingRegisterProps> = ({ blocks, cuttingHistory, onSave }) => {
    const [selectedCutter, setSelectedCutter] = useState<string>('');
    const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
    const [cuttingForm, setCuttingForm] = useState({ 
        block_issue_date: '', 
        cutting_date: '', 
        cut_length_ft: 0, 
        cut_height_ft: 0, 
        pcs: 0, 
        thickness_mm: 0 
    });
    const [completionStatus, setCompletionStatus] = useState<'Pending' | 'OK'>('Pending');
    const [sqft, setSqft] = useState(0);
    const [isContinuation, setIsContinuation] = useState(false);
    const [blockSearch, setBlockSearch] = useState('');

    const cutters = ['CUTTER-1', 'CUTTER-2', 'CUTTER-3', 'CUTTER-4'];

    const availableBlocks = blocks.filter(block => block.status === 'Pending' || block.status === 'Partial');
    const filteredAvailableBlocks = availableBlocks.filter(b => 
        b.block_no.toLowerCase().includes(blockSearch.toLowerCase()) ||
        b.color_name.toLowerCase().includes(blockSearch.toLowerCase())
    );
    const historyToShow = selectedBlock ? cuttingHistory.filter(entry => entry.block_id === selectedBlock.id) : cuttingHistory;

    useEffect(() => {
        if (selectedBlock) {
            const firstEntry = cuttingHistory.find(entry => entry.block_id === selectedBlock.id);
            const today = new Date().toISOString().split('T')[0];

            if (firstEntry) {
                // This is a continuation of a previous cut
                setIsContinuation(true);
                setCuttingForm({
                    block_issue_date: firstEntry.block_issue_date,
                    cutting_date: today, // New cutting date for this entry
                    cut_length_ft: firstEntry.cut_length_ft, // Fixed from first entry
                    cut_height_ft: firstEntry.cut_height_ft, // Fixed from first entry
                    pcs: 0, // Reset for new entry
                    thickness_mm: firstEntry.thickness_mm, // Fixed from first entry
                });
            } else {
                // This is a brand new cut for this block
                setIsContinuation(false);
                setCuttingForm({
                    block_issue_date: today,
                    cutting_date: today,
                    cut_length_ft: 0,
                    cut_height_ft: 0,
                    pcs: 0,
                    thickness_mm: 0,
                });
            }
            setCompletionStatus('Pending');
        } else {
            setIsContinuation(false);
            setCuttingForm({ block_issue_date: '', cutting_date: '', cut_length_ft: 0, cut_height_ft: 0, pcs: 0, thickness_mm: 0 });
        }
    }, [selectedBlock, cuttingHistory]);


    useEffect(() => {
        const { cut_length_ft, cut_height_ft, pcs } = cuttingForm;
        const calculatedSqft = cut_length_ft * cut_height_ft * pcs;
        setSqft(parseFloat(calculatedSqft.toFixed(2)));
    }, [cuttingForm]);
    
    const handleCutterSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedCutter(e.target.value);
        setSelectedBlock(null);
    };

    const handleBlockSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const block = availableBlocks.find(b => b.block_no === e.target.value) || null;
        setSelectedBlock(block);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setCuttingForm(prev => ({...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value}));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBlock) {
            alert('Please select a block.');
            return;
        }
        const newEntryData: Omit<CuttingEntry, 'id'> = {
            block_id: selectedBlock.id,
            block_no: selectedBlock.block_no,
            cutter_name: selectedCutter,
            ...cuttingForm,
            sqft_per_entry: sqft,
        };
        const newBlockStatus = completionStatus === 'OK' ? 'OK' : 'Partial';

        onSave(newEntryData, newBlockStatus);

        alert(`Cutting entry for ${selectedBlock?.block_no} on ${selectedCutter} saved!`);
        setSelectedBlock(null);
        setBlockSearch('');
    };
    
    const inputStyles = (isDisabled: boolean) => 
      `mt-1 w-full bg-accent border-gray-600 rounded-md p-2 ${isDisabled ? 'bg-gray-700 cursor-not-allowed text-highlight' : ''}`;


    return (
        <div className="space-y-8">
            <div className="bg-secondary p-8 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold text-text-primary mb-4">New Cutting Entry</h2>

                <div className="mb-6">
                    <label htmlFor="cutter_select" className="block text-sm font-medium text-highlight">Step 1: Select Cutter Machine</label>
                    <select id="cutter_select" value={selectedCutter} onChange={handleCutterSelect} className="mt-1 block w-full md:w-1/3 bg-accent border-gray-600 rounded-md shadow-sm focus:ring-brand focus:border-brand sm:text-sm p-2">
                        <option value="">Select a cutter...</option>
                        {cutters.map(cutter => <option key={cutter} value={cutter}>{cutter}</option>)}
                    </select>
                </div>


                {selectedCutter && (
                    <div className="border-t border-accent pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <div>
                                <label htmlFor="block_search" className="block text-sm font-medium text-highlight">Step 2: Find & Select Block</label>
                                <input
                                    type="text"
                                    id="block_search"
                                    placeholder="Search by Block No or Color..."
                                    value={blockSearch}
                                    onChange={(e) => setBlockSearch(e.target.value)}
                                    className="mt-1 block w-full bg-accent border-gray-600 rounded-md p-2 mb-2"
                                />
                                <select id="block_no_select" onChange={handleBlockSelect} value={selectedBlock?.block_no || ''} className="mt-1 block w-full bg-accent border-gray-600 rounded-md shadow-sm focus:ring-brand focus:border-brand sm:text-sm p-2">
                                    <option value="">Select a block...</option>
                                    {filteredAvailableBlocks.map(b => <option key={b.id} value={b.block_no}>{b.block_no} - {b.color_name}</option>)}
                                </select>
                            </div>
                            {selectedBlock && (
                                <>
                                    <div className="p-2 bg-accent rounded-md self-end"><span className="text-highlight">Color:</span> {selectedBlock.color_name}</div>
                                    <div className="p-2 bg-accent rounded-md self-end"><span className="text-highlight">CBM:</span> {selectedBlock.cubic_m}</div>
                                    <div className="p-2 bg-accent rounded-md col-span-1 md:col-span-3"><span className="text-highlight">Dimensions:</span> {selectedBlock.length_cm}x{selectedBlock.height_cm}x{selectedBlock.width_cm} cm</div>
                                </>
                            )}
                        </div>

                        {selectedBlock && (
                             <form onSubmit={handleSubmit} className="space-y-4 pt-6 border-t border-accent">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-highlight">Block Issue Date</label>
                                        <input type="date" name="block_issue_date" value={cuttingForm.block_issue_date} onChange={handleFormChange} className={inputStyles(isContinuation)} disabled={isContinuation} required/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-highlight">Cutting Date</label>
                                        <input type="date" name="cutting_date" value={cuttingForm.cutting_date} onChange={handleFormChange} className={inputStyles(false)} required/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-highlight">Cut Length (ft)</label>
                                        <input type="number" step="0.01" name="cut_length_ft" placeholder="e.g., 10.5" value={cuttingForm.cut_length_ft} onChange={handleFormChange} className={inputStyles(isContinuation)} disabled={isContinuation} required/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-highlight">Cut Height (ft)</label>
                                        <input type="number" step="0.01" name="cut_height_ft" placeholder="e.g., 3.28" value={cuttingForm.cut_height_ft} onChange={handleFormChange} className={inputStyles(isContinuation)} disabled={isContinuation} required/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-highlight">No. of Pcs</label>
                                        <input type="number" name="pcs" placeholder="e.g., 5" value={cuttingForm.pcs} onChange={handleFormChange} className={inputStyles(false)} required/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-highlight">Thickness (mm)</label>
                                        <input type="number" name="thickness_mm" placeholder="e.g., 20" value={cuttingForm.thickness_mm} onChange={handleFormChange} className={inputStyles(isContinuation)} disabled={isContinuation} required/>
                                    </div>
                                    <div className="flex flex-col justify-end">
                                        <label className="block text-sm font-medium text-highlight">Sqft</label>
                                        <div className="mt-1 p-2 h-10 flex items-center bg-gray-700 rounded-md font-bold">{sqft}</div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-highlight">Block Completion Status</label>
                                        <select 
                                            value={completionStatus} 
                                            onChange={(e) => setCompletionStatus(e.target.value as 'Pending' | 'OK')}
                                            className="mt-1 w-full h-10 bg-accent border-gray-600 rounded-md p-2"
                                        >
                                            <option value="Pending">Cutting Pending</option>
                                            <option value="OK">Full Cutting OK</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <button type="submit" className="px-6 py-2 bg-brand text-white font-semibold rounded-md shadow-md hover:bg-teal-500">Add Entry</button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </div>
            
            <div className="bg-secondary p-8 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold text-text-primary mb-4">
                    Cutting History {selectedBlock ? `(${selectedBlock.block_no})` : '(All Recent)'}
                </h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-accent">
                        <thead className="bg-accent">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Issue Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Cutting Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Cutter</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Block No</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Length (ft)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Height (ft)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Pcs</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Thickness (mm)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Sqft</th>
                            </tr>
                        </thead>
                        <tbody className="bg-secondary divide-y divide-accent">
                            {historyToShow.map((entry: CuttingEntry) => (
                                <tr key={entry.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{entry.block_issue_date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{entry.cutting_date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{entry.cutter_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{entry.block_no}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{entry.cut_length_ft}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{entry.cut_height_ft}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{entry.pcs}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{entry.thickness_mm}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{entry.sqft_per_entry}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {historyToShow.length === 0 && <p className="text-center py-8 text-highlight">No cutting history found for this block.</p>}
                </div>
            </div>
        </div>
    );
};

export default CuttingRegister;