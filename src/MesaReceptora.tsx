import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

interface Voter {
    id: string;
    name: string;
    age: number | null;
    birth_date: string | null;
    activity: string | null;
    status: string;
    created_at: string;
}

export default function MesaReceptora() {
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [activity, setActivity] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
    const [recentVoters, setRecentVoters] = useState<Voter[]>([]);
    const [currentVoter, setCurrentVoter] = useState<Voter | null>(null);
    const [editingVoter, setEditingVoter] = useState<Voter | null>(null);
    const [editForm, setEditForm] = useState({ name: '', age: '', birth_date: '', activity: '' });

    // Carregar lista de eleitores recentes
    const loadVoters = async () => {
        if (!isSupabaseConfigured) return;
        const { data } = await supabase
            .from('voter_queue')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        if (data) setRecentVoters(data);

        // Verificar se há eleitor votando
        const { data: pending } = await supabase
            .from('voter_queue')
            .select('*')
            .in('status', ['pending', 'voting'])
            .order('created_at', { ascending: true })
            .limit(1);
        if (pending && pending.length > 0) {
            setCurrentVoter(pending[0]);
        } else {
            setCurrentVoter(null);
        }
    };

    useEffect(() => {
        loadVoters();
        const interval = setInterval(loadVoters, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (!isSupabaseConfigured) {
            setMessage({ type: 'error', text: 'Supabase não configurado.' });
            return;
        }

        setIsSubmitting(true);
        setMessage(null);

        try {
            // Verificar se já votou (por nome + data de nascimento)
            const normalizedName = name.trim().toUpperCase();
            let query = supabase
                .from('voter_queue')
                .select('*')
                .eq('name', normalizedName)
                .eq('status', 'voted');

            if (birthDate) {
                query = query.eq('birth_date', birthDate);
            }

            const { data: existing } = await query;

            if (existing && existing.length > 0) {
                setMessage({
                    type: 'error',
                    text: `⚠️ ${normalizedName} já votou! Voto registrado em ${new Date(existing[0].created_at).toLocaleString('pt-BR')}.`
                });
                setIsSubmitting(false);
                return;
            }

            // Verificar se já está na fila (pendente ou votando)
            const { data: inQueue } = await supabase
                .from('voter_queue')
                .select('*')
                .eq('name', normalizedName)
                .in('status', ['pending', 'voting']);

            if (inQueue && inQueue.length > 0) {
                setMessage({
                    type: 'warning',
                    text: `${normalizedName} já está na fila de votação.`
                });
                setIsSubmitting(false);
                return;
            }

            // Inserir na fila
            const { error } = await supabase.from('voter_queue').insert({
                name: normalizedName,
                age: age ? parseInt(age) : null,
                birth_date: birthDate || null,
                activity: activity.trim().toUpperCase() || null,
                status: 'pending',
            });

            if (error) throw error;

            setMessage({ type: 'success', text: `✅ Voto de ${normalizedName} liberado na urna!` });
            setName('');
            setAge('');
            setBirthDate('');
            setActivity('');
            await loadVoters();
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Erro ao registrar: ' + err.message });
        }

        setIsSubmitting(false);
    };

    const cancelVoter = async (voterId: string) => {
        if (!window.confirm('Cancelar este eleitor da fila?')) return;
        await supabase.from('voter_queue').update({ status: 'cancelled' }).eq('id', voterId);
        await loadVoters();
    };

    const startEditVoter = (voter: Voter) => {
        setEditingVoter(voter);
        setEditForm({
            name: voter.name || '',
            age: voter.age?.toString() || '',
            birth_date: voter.birth_date || '',
            activity: voter.activity || '',
        });
    };

    const saveEditVoter = async () => {
        if (!editingVoter || !editForm.name.trim()) return;
        await supabase.from('voter_queue').update({
            name: editForm.name.trim().toUpperCase(),
            age: editForm.age ? parseInt(editForm.age) : null,
            birth_date: editForm.birth_date || null,
            activity: editForm.activity.trim().toUpperCase() || null,
        }).eq('id', editingVoter.id);
        setEditingVoter(null);
        await loadVoters();
    };

    const clearList = async () => {
        if (!window.confirm('Tem certeza que deseja ZERAR toda a fila de votação?\nEssa ação não pode ser desfeita.')) return;
        await supabase.from('voter_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await loadVoters();
    };

    const printList = () => {
        const voted = recentVoters.filter(v => v.status === 'voted');
        let html = `<html><head><title>Lista de Eleitores</title><style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 500px; margin: 0 auto; }
            h1 { text-align: center; font-size: 18px; border-bottom: 2px solid #000; padding-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { text-align: left; font-size: 11px; border-bottom: 2px solid #000; padding: 4px 2px; }
            td { font-size: 11px; padding: 3px 2px; border-bottom: 1px dashed #ccc; }
            .total { font-weight: bold; font-size: 14px; text-align: center; border-top: 2px solid #000; margin-top: 12px; padding-top: 8px; }
            .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #666; }
            @media print { body { padding: 0; } }
        </style></head><body>`;
        html += `<h1>LISTA DE ELEITORES</h1>`;
        html += `<p style="text-align:center;font-size:11px;color:#666;">Emitido em: ${new Date().toLocaleString('pt-BR')}</p>`;
        html += `<table><thead><tr><th>#</th><th>NOME</th><th>IDADE</th><th>ATIVIDADE</th></tr></thead><tbody>`;
        voted.forEach((v, i) => {
            html += `<tr><td>${i + 1}</td><td>${v.name}</td><td>${v.age || '-'}</td><td>${v.activity || '-'}</td></tr>`;
        });
        html += `</tbody></table>`;
        html += `<div class="total">TOTAL DE ELEITORES: ${voted.length}</div>`;
        html += `<div class="footer">COMITÊ MAIS INFÂNCIA<br/>Mesa Receptora - Urna Eletrônica</div>`;
        html += `</body></html>`;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 500);
        }
    };

    const statusLabel = (status: string) => {
        switch (status) {
            case 'pending': return '⏳ Aguardando';
            case 'voting': return '🗳️ Votando';
            case 'voted': return '✅ Votou';
            case 'cancelled': return '❌ Cancelado';
            default: return status;
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'voting': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'voted': return 'bg-green-100 text-green-800 border-green-300';
            case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
            default: return 'bg-zinc-100 text-zinc-800';
        }
    };

    const votedCount = recentVoters.filter(v => v.status === 'voted').length;

    return (
        <div className="h-screen w-screen bg-zinc-100 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-zinc-800 text-white px-6 py-4 flex items-center justify-between shadow-lg">
                <div>
                    <h1 className="text-xl font-black uppercase tracking-wider">Mesa Receptora</h1>
                    <p className="text-xs text-zinc-400 font-bold uppercase">Identificação do Eleitor</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase">Eleitores</p>
                        <p className="text-2xl font-black text-emerald-400">{votedCount}</p>
                    </div>
                    {currentVoter && (
                        <div className={`px-3 py-1 rounded text-xs font-black uppercase border ${currentVoter.status === 'pending' ? 'bg-yellow-500 border-yellow-600 text-yellow-900' : 'bg-blue-500 border-blue-600 text-white'
                            }`}>
                            {currentVoter.status === 'pending' ? '⏳ Aguardando na Urna' : '🗳️ Votando'}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex gap-4 p-4 overflow-hidden">
                {/* Formulário */}
                <div className="w-96 flex-none flex flex-col">
                    <form onSubmit={handleSubmit} className="bg-white border-2 border-zinc-300 p-6 shadow-sm flex flex-col gap-4">
                        <h2 className="text-lg font-black text-zinc-900 uppercase border-b-2 border-zinc-200 pb-2">Dados do Eleitor</h2>

                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Nome Completo *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full border-2 border-zinc-300 p-3 font-bold uppercase text-black focus:border-zinc-800 outline-none text-sm"
                                placeholder="Nome do eleitor"
                                required
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Idade</label>
                                <input
                                    type="number"
                                    value={age}
                                    onChange={e => setAge(e.target.value)}
                                    className="w-full border-2 border-zinc-300 p-3 font-bold text-black focus:border-zinc-800 outline-none text-sm"
                                    placeholder="Ex: 25"
                                    min="1"
                                    max="150"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Data de Nascimento</label>
                                <input
                                    type="date"
                                    value={birthDate}
                                    onChange={e => setBirthDate(e.target.value)}
                                    className="w-full border-2 border-zinc-300 p-3 font-bold text-black focus:border-zinc-800 outline-none text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Atividade</label>
                            <input
                                type="text"
                                value={activity}
                                onChange={e => setActivity(e.target.value)}
                                className="w-full border-2 border-zinc-300 p-3 font-bold uppercase text-black focus:border-zinc-800 outline-none text-sm"
                                placeholder="Ex: Estudante"
                            />
                        </div>

                        {message && (
                            <div className={`p-3 border-2 font-bold text-sm ${message.type === 'success' ? 'bg-green-50 border-green-300 text-green-800' :
                                message.type === 'warning' ? 'bg-yellow-50 border-yellow-300 text-yellow-800' :
                                    'bg-red-50 border-red-300 text-red-800'
                                }`}>
                                {message.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim()}
                            className="bg-emerald-500 text-white px-6 py-4 font-black uppercase text-lg hover:bg-emerald-600 transition-colors shadow-lg border-b-4 border-emerald-700 active:translate-y-[2px] active:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Registrando...' : '🗳️ Liberar Voto'}
                        </button>
                    </form>
                </div>

                {/* Lista de eleitores */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-sm font-black text-zinc-800 uppercase">Fila de Votação</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={printList}
                                className="bg-zinc-200 hover:bg-zinc-300 text-zinc-700 px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-colors"
                            >
                                🖨️ Imprimir
                            </button>
                            <button
                                onClick={clearList}
                                className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-colors"
                            >
                                🗑️ Zerar Lista
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {recentVoters.length === 0 ? (
                            <div className="bg-white border-2 border-zinc-300 p-8 text-center">
                                <p className="text-zinc-400 font-bold uppercase text-sm">Nenhum eleitor registrado</p>
                            </div>
                        ) : (
                            recentVoters.map(voter => (
                                <div key={voter.id} className={`bg-white border-2 p-3 flex items-center gap-4 ${voter.status === 'voting' ? 'border-blue-400 bg-blue-50' :
                                    voter.status === 'pending' ? 'border-yellow-400 bg-yellow-50' :
                                        'border-zinc-200'
                                    }`}>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-zinc-900 uppercase text-sm truncate">{voter.name}</p>
                                        <div className="flex gap-3 text-[10px] font-bold text-zinc-500 uppercase mt-0.5">
                                            {voter.age && <span>{voter.age} anos</span>}
                                            {voter.birth_date && <span>{new Date(voter.birth_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                                            {voter.activity && <span>{voter.activity}</span>}
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 text-[10px] font-black uppercase border rounded ${statusColor(voter.status)}`}>
                                        {statusLabel(voter.status)}
                                    </span>
                                    {(voter.status === 'pending' || voter.status === 'voting') && (
                                        <div className="flex gap-2">
                                            {voter.status === 'pending' && (
                                                <button
                                                    onClick={() => startEditVoter(voter)}
                                                    className="bg-zinc-200 hover:bg-zinc-300 text-zinc-700 px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-colors"
                                                >
                                                    ✏️ Editar
                                                </button>
                                            )}
                                            <button
                                                onClick={() => cancelVoter(voter.id)}
                                                className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-colors"
                                            >
                                                ❌ Cancelar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Edição */}
            {editingVoter && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingVoter(null)}>
                    <div className="bg-white border-2 border-zinc-300 p-6 shadow-xl w-[420px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-black text-zinc-900 uppercase border-b-2 border-zinc-200 pb-2 mb-4">Editar Eleitor</h2>

                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Nome Completo *</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full border-2 border-zinc-300 p-3 font-bold uppercase text-black focus:border-zinc-800 outline-none text-sm"
                                    autoFocus
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Idade</label>
                                    <input
                                        type="number"
                                        value={editForm.age}
                                        onChange={e => setEditForm({ ...editForm, age: e.target.value })}
                                        className="w-full border-2 border-zinc-300 p-3 font-bold text-black focus:border-zinc-800 outline-none text-sm"
                                        min="1" max="150"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Data de Nascimento</label>
                                    <input
                                        type="date"
                                        value={editForm.birth_date}
                                        onChange={e => setEditForm({ ...editForm, birth_date: e.target.value })}
                                        className="w-full border-2 border-zinc-300 p-3 font-bold text-black focus:border-zinc-800 outline-none text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Atividade</label>
                                <input
                                    type="text"
                                    value={editForm.activity}
                                    onChange={e => setEditForm({ ...editForm, activity: e.target.value })}
                                    className="w-full border-2 border-zinc-300 p-3 font-bold uppercase text-black focus:border-zinc-800 outline-none text-sm"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={saveEditVoter}
                                    disabled={!editForm.name.trim()}
                                    className="flex-1 bg-emerald-500 text-white px-4 py-3 font-black uppercase hover:bg-emerald-600 transition-colors shadow-md border-b-4 border-emerald-700 disabled:opacity-50"
                                >
                                    ✅ Salvar
                                </button>
                                <button
                                    onClick={() => setEditingVoter(null)}
                                    className="flex-1 bg-zinc-300 text-zinc-800 px-4 py-3 font-black uppercase hover:bg-zinc-400 transition-colors shadow-md border-b-4 border-zinc-400"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
