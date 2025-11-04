import React, { useState } from 'react';

interface CompanyGateProps {
    companies: string[];
    onCreateCompany: (companyName: string) => void;
    onSelectCompany: (companyName: string) => void;
}

const CompanyGate: React.FC<CompanyGateProps> = ({ companies, onCreateCompany, onSelectCompany }) => {
    const [companyName, setCompanyName] = useState('');
    const [view, setView] = useState<'select' | 'create'>(companies.length > 0 ? 'select' : 'create');

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (companyName.trim()) {
            if (companies.includes(companyName.trim())) {
                alert('A company with this name already exists.');
            } else {
                onCreateCompany(companyName.trim());
            }
        } else {
            alert('Please enter a company name.');
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-primary text-text-primary">
            <div className="w-full max-w-md bg-secondary p-8 rounded-lg shadow-2xl animate-fade-in">
                {view === 'create' && (
                    <div>
                        <h1 className="text-2xl font-bold mb-2 text-brand">Welcome!</h1>
                        <h2 className="text-xl font-semibold mb-6">
                            {companies.length === 0 ? 'Create Your First Company' : 'Create a New Company'}
                        </h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label htmlFor="companyName" className="block text-sm font-medium text-highlight">Company Name</label>
                                <input
                                    id="companyName"
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="e.g., Marble Enterprises"
                                    className="mt-1 block w-full bg-accent p-2 rounded-md"
                                    autoFocus
                                />
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                {companies.length > 0 ? (
                                    <button type="button" onClick={() => setView('select')} className="text-sm text-brand hover:underline">
                                        &larr; Back to Select
                                    </button>
                                ) : <div />}
                                <button type="submit" className="px-6 py-2 bg-brand text-white font-semibold rounded-md shadow-md hover:bg-teal-500">
                                    Create & Start
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {view === 'select' && (
                    <div>
                        <h1 className="text-2xl font-bold mb-6 text-center text-brand">Select a Company</h1>
                        <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
                            {companies.map(name => (
                                <button
                                    key={name}
                                    onClick={() => onSelectCompany(name)}
                                    className="w-full text-left p-4 bg-accent hover:bg-gray-600 rounded-md transition-colors"
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                        <div className="border-t border-accent pt-4 text-center">
                             <button onClick={() => setView('create')} className="px-6 py-2 bg-brand text-white font-semibold rounded-md shadow-md hover:bg-teal-500">
                                + Create New Company
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompanyGate;
