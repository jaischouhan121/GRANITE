import React, { useState, useEffect } from 'react';
import { Block } from '../types';

interface SingleCutterRegisterProps {
    blocks: Block[];
    onSplit: (originalBlockId: number, newParts: { block_no: string }[]) => void;
}

const SingleCutterRegister: React.FC<SingleCutterRegisterProps> = ({ blocks, onSplit }) => {
    const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
    const [numParts, setNumParts] = useState<number>(2);
    const [parts, setParts] = useState<{ block_no: string }[]>([]);
    const [blockSearch, setBlockSearch] = useState('');
    const [isConfirming, setIsConfirming] = useState(false);

    const availableBlocks = blocks.filter(b => b.status === 'Pending');
    const filteredAvailableBlocks = availableBlocks.filter(b => 
        b.block_no.toLowerCase().includes(blockSearch.toLowerCase()) ||
        b.color_name.toLowerCase().includes(blockSearch.toLowerCase())
    );
    
    useEffect(() => {
        if (selectedBlock && numParts > 0) {
            const newPartsArray = Array.from({ length: numParts }, (_, i) => {
                const suffix = String.fromCharCode(65 + i); // A, B, C...
                return { block_no: `${selectedBlock.block_no}${suffix}` };
            });
            setParts(newPartsArray);
        } else {
            setParts([]);
        }
    }, [selectedBlock, numParts]);

    const handleBlockSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const block = availableBlocks.find(b => b.id === parseInt(e.target.value)) || null;
        setSelectedBlock(block);
        setIsConfirming(false);
    };

    const handlePartBlockNoChange = (index: number, newBlockNo: string) => {
        const updatedParts = [...parts];
        updatedParts[index].block_no = newBlockNo;
        setParts(updatedParts);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBlock || parts.length === 0) {
            alert("Please select a block and specify parts.");
            return;
        }

        const isDuplicate = new Set(parts.map(p => p.block_no)).size !== parts.length;
        if(isDuplicate) {
            alert("Duplicate part numbers are not allowed.");
            return;
        }
        
        setIsConfirming(true);
    };

    const handleConfirmSplit = () => {
        if (!selectedBlock) return;
        onSplit(selectedBlock.id, parts);
        alert("Block has been split successfully!");
        setSelectedBlock(null);
        setBlockSearch('');
        setNumParts(2);
        setIsConfirming(false);
    };
    
    const handleCancelSplit = () => {
        setIsConfirming(false);
    };


    return (
        <div className="bg-secondary p-8 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold text-text-primary mb-6">Split Large Block into Parts</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="block_search" className="block text-sm font-medium text-highlight">Step 1: Find & Select Block to Split</label>
                    <input
                        type="text"
                        id="block_search"
                        placeholder="Search by Block No or Color..."
                        value={blockSearch}
                        onChange={(e) => setBlockSearch(e.target.value)}
                        className="mt-1 block w-full bg-accent border-gray-600 rounded-md p-2 mb-2"
                    />
                    <select 
                        onChange={handleBlockSelect} 
                        value={selectedBlock?.id || ''} 
                        className="mt-1 block w-full bg-accent border-gray-600 rounded-md shadow-sm focus:ring-brand focus:border-brand sm:text-sm p-2"
                    >
                        <option value="">Select a pending block...</option>
                        {filteredAvailableBlocks.map(b => (
                            <option key={b.id} value={b.id}>{b.block_no} - {b.color_name}</option>
                        ))}
                    </select>
                </div>

                {selectedBlock && (
                    <div className="border-t border-accent pt-6 space-y-6 animate-fade-in">
                         <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                            <div className="p-2 bg-accent rounded-md"><span className="text-highlight">Color:</span> {selectedBlock.color_name}</div>
                            <div className="p-2 bg-accent rounded-md"><span className="text-highlight">CBM:</span> {selectedBlock.cubic_m}</div>
                            <div className="p-2 bg-accent rounded-md col-span-1 md:col-span-2"><span className="text-highlight">Dimensions:</span> {selectedBlock.length_cm}x{selectedBlock.height_cm}x{selectedBlock.width_cm} cm</div>
                        </div>

                        <div>
                            <label htmlFor="num_parts" className="block text-sm font-medium text-highlight">Step 2: Number of Parts to Create</label>
                            <input
                                type="number"
                                id="num_parts"
                                value={numParts}
                                onChange={(e) => {
                                    setNumParts(Math.max(1, parseInt(e.target.value) || 1));
                                    setIsConfirming(false);
                                }}
                                min="1"
                                className="mt-1 block w-full md:w-1/4 bg-accent border-gray-600 rounded-md p-2"
                            />
                        </div>

                        {parts.length > 0 && (
                             <div>
                                <h3 className="text-md font-medium text-highlight mb-2">Step 3: Confirm New Block Numbers</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {parts.map((part, index) => (
                                    <div key={index}>
                                        <label className="block text-xs font-medium text-gray-400">Part {index + 1}</label>
                                        <input
                                            type="text"
                                            value={part.block_no}
                                            onChange={(e) => {
                                                handlePartBlockNoChange(index, e.target.value);
                                                setIsConfirming(false);
                                            }}
                                            className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md p-2"
                                        />
                                    </div>
                                ))}
                                </div>
                            </div>
                        )}
                        
                        <div className="flex justify-end pt-6 border-t border-accent">
                            {!isConfirming ? (
                                <button 
                                    type="submit" 
                                    className="px-6 py-2 bg-brand text-white font-semibold rounded-md shadow-md hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand focus:ring-offset-secondary"
                                >
                                    Split Block
                                </button>
                            ) : (
                                <div className="w-full bg-yellow-900/50 border border-yellow-600 p-4 rounded-md flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div>
                                        <p className="font-semibold text-yellow-200">Please confirm your action.</p>
                                        <p className="text-sm text-yellow-300">
                                            This will mark block <span className="font-bold">{selectedBlock?.block_no}</span> as processed and create <span className="font-bold">{parts.length}</span> new blocks:
                                            <span className="font-mono text-xs block mt-1 bg-black/20 p-1 rounded">{parts.map(p => p.block_no).join(', ')}</span>
                                        </p>
                                    </div>
                                    <div className="flex gap-4 flex-shrink-0">
                                        <button 
                                            type="button" 
                                            onClick={handleCancelSplit}
                                            className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-500"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={handleConfirmSplit}
                                            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-500"
                                        >
                                            Confirm Split
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
};

export default SingleCutterRegister;