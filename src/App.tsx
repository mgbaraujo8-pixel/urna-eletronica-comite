/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, Pencil, Trash2, Ban } from 'lucide-react';

import { VOTE_STEPS, Candidate, VoteStep } from './constants';
import { supabase } from './supabaseClient';

export default function App() {
  const [voteSteps, setVoteSteps] = useState<VoteStep[]>(VOTE_STEPS);
  const [stepIndex, setStepIndex] = useState(0);
  const [digits, setDigits] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [isWhiteVote, setIsWhiteVote] = useState(false);
  const [isInvalidVote, setIsInvalidVote] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Config states
  const [isConfigPromptOpen, setIsConfigPromptOpen] = useState(false);
  const [isConfigMode, setIsConfigMode] = useState(false);
  const [configTab, setConfigTab] = useState<'candidates' | 'categories'>('candidates');
  const [isShowingNewCandidateForm, setIsShowingNewCandidateForm] = useState(false);
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editCategoryData, setEditCategoryData] = useState({ title: '', digits: 0 });
  const [enabledCategories, setEnabledCategories] = useState<string[]>([]);
  const [newCandidate, setNewCandidate] = useState({ name: '', number: '', party: '', photo: '', age: '', activity: '' });

  // === SUPABASE: Carregar dados ===
  const loadDataFromSupabase = async () => {
    try {
      const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (catError) throw catError;

      if (!categories || categories.length === 0) {
        // Banco vazio: usar dados padrão e popular o banco
        await seedDatabase();
        return;
      }

      const { data: allCandidates, error: candError } = await supabase
        .from('candidates')
        .select('*');

      if (candError) throw candError;

      const steps: VoteStep[] = categories.map(cat => ({
        id: cat.id,
        title: cat.title,
        digits: cat.digits,
        enabled: cat.enabled,
        sort_order: cat.sort_order,
        candidates: (allCandidates || []).filter(c => c.category_id === cat.id).map(c => ({
          id: c.id,
          category_id: c.category_id,
          number: c.number,
          name: c.name,
          party: c.party,
          vice: c.vice,
          photo: c.photo || '',
          age: c.age,
          activity: c.activity,
          votes: c.votes || 0,
          suspended: c.suspended || false,
        }))
      }));

      setVoteSteps(steps);
      setEnabledCategories(steps.filter(s => s.enabled !== false).map(s => s.title));
    } catch (err) {
      console.error('Erro ao carregar dados do Supabase:', err);
      setVoteSteps(VOTE_STEPS);
      setEnabledCategories(VOTE_STEPS.map(s => s.title));
    } finally {
      setIsLoading(false);
    }
  };

  const seedDatabase = async () => {
    try {
      for (let i = 0; i < VOTE_STEPS.length; i++) {
        const step = VOTE_STEPS[i];
        const { data: cat, error: catErr } = await supabase
          .from('categories')
          .insert({ title: step.title, digits: step.digits, sort_order: i, enabled: true })
          .select()
          .single();

        if (catErr || !cat) continue;

        for (const c of step.candidates) {
          await supabase.from('candidates').insert({
            category_id: cat.id,
            name: c.name,
            number: c.number,
            party: c.party,
            vice: c.vice || null,
            photo: c.photo,
            age: c.age || null,
            activity: c.activity || null,
            votes: 0,
            suspended: false,
          });
        }
      }
      await loadDataFromSupabase();
    } catch (err) {
      console.error('Erro ao popular banco:', err);
      setVoteSteps(VOTE_STEPS);
      setEnabledCategories(VOTE_STEPS.map(s => s.title));
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDataFromSupabase();
  }, []);

  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  useEffect(() => {
    audioRefs.current = {
      click: new Audio('https://raw.githubusercontent.com/william-costa/urna-eletronica-react/master/public/sounds/se1.mp3'),
      confirm: new Audio('https://raw.githubusercontent.com/william-costa/urna-eletronica-react/master/public/sounds/se2.mp3'),
      end: new Audio('/sounds/Z Mobile  Music Editor_2026_03_08_10_02_20.mp3')
    };

    (Object.values(audioRefs.current) as HTMLAudioElement[]).forEach(audio => {
      audio.load();
    });
  }, []);

  const activeVoteSteps = voteSteps.filter(step => enabledCategories.includes(step.title));
  const currentStep = activeVoteSteps[stepIndex];

  const playSound = (type: 'click' | 'confirm' | 'end') => {
    const audio = audioRefs.current[type];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => {
        console.log("Audio play blocked:", e);
      });
    }
  };

  const handleNumberClick = (num: string) => {
    if (isFinished || isWhiteVote || isConfigMode || isConfigPromptOpen) return;

    playSound('click');
    const newDigits = [...digits, num];
    setDigits(newDigits);

    if (newDigits.join('') === '0000') {
      setIsConfigPromptOpen(true);
      return;
    }

    if (newDigits.length === currentStep.digits) {
      const found = currentStep.candidates.find(c => c.number === newDigits.join('') && !c.suspended);
      if (found) {
        setCandidate(found);
        setIsInvalidVote(false);
      } else {
        setCandidate(null);
        setIsInvalidVote(true);
      }
      setShowInstructions(true);
    }
  };

  const handleBranco = () => {
    if (isFinished || digits.length > 0 || isConfigMode || isConfigPromptOpen) return;
    playSound('click');
    setIsWhiteVote(true);
    setShowInstructions(true);
  };

  const handleCorrige = () => {
    if (isFinished) return;
    playSound('click');
    if (isConfigMode) {
      setIsConfigMode(false);
      setStepIndex(0);
      setIsShowingNewCandidateForm(false);
      return;
    }
    if (isConfigPromptOpen) {
      setIsConfigPromptOpen(false);
      setDigits([]);
      return;
    }
    setDigits([]);
    setCandidate(null);
    setIsWhiteVote(false);
    setIsInvalidVote(false);
    setShowInstructions(false);
  };

  const handleConfirma = () => {
    if (isFinished) return;

    if (isConfigPromptOpen) {
      playSound('confirm');
      setIsConfigPromptOpen(false);
      setIsConfigMode(true);
      setDigits([]);
      return;
    }

    if (isConfigMode) {
      // Logic to add candidate is handled in the form, but we can use Confirma to save too
      return;
    }

    const canConfirm = isWhiteVote || (digits.length === currentStep.digits);

    if (canConfirm) {
      if (candidate) {
        // Atualizar votos localmente
        setVoteSteps(prevSteps => prevSteps.map(step => {
          if (step.title !== currentStep.title) return step;
          return {
            ...step,
            candidates: step.candidates.map(c =>
              c.number === candidate.number ? { ...c, votes: (c.votes || 0) + 1 } : c
            )
          };
        }));

        // Persistir voto no Supabase
        if (candidate.id) {
          supabase.from('candidates')
            .update({ votes: (candidate.votes || 0) + 1 })
            .eq('id', candidate.id)
            .then();

          supabase.from('vote_logs').insert({
            category_id: currentStep.id,
            candidate_id: candidate.id,
            vote_type: 'candidate',
          }).then();
        }
      } else if (isWhiteVote && currentStep.id) {
        supabase.from('vote_logs').insert({
          category_id: currentStep.id,
          candidate_id: null,
          vote_type: 'white',
        }).then();
      } else if (isInvalidVote && currentStep.id) {
        supabase.from('vote_logs').insert({
          category_id: currentStep.id,
          candidate_id: null,
          vote_type: 'null',
        }).then();
      }

      if (stepIndex < activeVoteSteps.length - 1) {
        playSound('confirm');
        setStepIndex(stepIndex + 1);
        handleCorrige();
      } else {
        playSound('end');
        setIsFinished(true);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewCandidate(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewCandidate(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const addCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCandidate.name || !newCandidate.number || !newCandidate.party) return;

    const targetStepIndex = voteSteps.findIndex(step => step.digits === newCandidate.number.length);
    if (targetStepIndex === -1) {
      alert("Número com quantidade de dígitos inválida para os cargos disponíveis.");
      return;
    }

    const targetStep = voteSteps[targetStepIndex];
    const photoUrl = newCandidate.photo || `https://picsum.photos/seed/${newCandidate.name}/100/120`;

    if (targetStep.id) {
      const { data, error } = await supabase.from('candidates').insert({
        category_id: targetStep.id,
        name: newCandidate.name,
        number: newCandidate.number,
        party: newCandidate.party,
        photo: photoUrl,
        age: newCandidate.age || null,
        activity: newCandidate.activity || null,
        votes: 0,
        suspended: false,
      }).select().single();

      if (error) { alert('Erro ao salvar candidato: ' + error.message); return; }

      const updatedSteps = [...voteSteps];
      updatedSteps[targetStepIndex].candidates.push({ ...newCandidate, id: data.id, category_id: data.category_id, photo: photoUrl });
      setVoteSteps(updatedSteps);
    } else {
      const updatedSteps = [...voteSteps];
      updatedSteps[targetStepIndex].candidates.push({ ...newCandidate, photo: photoUrl });
      setVoteSteps(updatedSteps);
    }

    setNewCandidate({ name: '', number: '', party: '', photo: '', age: '', activity: '' });
    setIsShowingNewCandidateForm(false);
    alert("Candidato adicionado com sucesso!");
  };

  const toggleSuspendCandidate = async (sIdx: number, cIdx: number) => {
    const updatedSteps = [...voteSteps];
    const c = updatedSteps[sIdx].candidates[cIdx];
    const newSuspended = !c.suspended;
    updatedSteps[sIdx].candidates[cIdx] = { ...c, suspended: newSuspended };
    setVoteSteps(updatedSteps);

    if (c.id) {
      await supabase.from('candidates').update({ suspended: newSuspended }).eq('id', c.id);
    }
  };

  const removeCandidate = async (sIdx: number, cIdx: number) => {
    if (window.confirm("Esta ação removerá o candidato permanentemente. Deseja continuar?")) {
      const c = voteSteps[sIdx].candidates[cIdx];
      const updatedSteps = [...voteSteps];
      updatedSteps[sIdx].candidates.splice(cIdx, 1);
      setVoteSteps(updatedSteps);

      if (c.id) {
        await supabase.from('candidates').delete().eq('id', c.id);
      }
    }
  };

  const handleEditCategory = (index: number) => {
    setEditingCategoryIndex(index);
    setEditCategoryData({
      title: voteSteps[index].title,
      digits: voteSteps[index].digits
    });
  };

  const saveCategory = async (index: number) => {
    if (!editCategoryData.title.trim() || editCategoryData.digits < 1) return;

    const oldTitle = voteSteps[index].title;
    const updatedSteps = [...voteSteps];
    updatedSteps[index] = { ...updatedSteps[index], ...editCategoryData };
    setVoteSteps(updatedSteps);

    if (enabledCategories.includes(oldTitle)) {
      setEnabledCategories(enabledCategories.map(c => c === oldTitle ? editCategoryData.title : c));
    }

    setEditingCategoryIndex(null);

    const catId = voteSteps[index].id;
    if (catId) {
      await supabase.from('categories').update({
        title: editCategoryData.title,
        digits: editCategoryData.digits,
      }).eq('id', catId);
    }
  };

  const addCategory = async () => {
    const newCategoryTitle = `NOVA CATEGORIA ${voteSteps.length + 1}`;

    const { data, error } = await supabase.from('categories').insert({
      title: newCategoryTitle,
      digits: 2,
      enabled: true,
      sort_order: voteSteps.length,
    }).select().single();

    if (error) { alert('Erro ao criar categoria: ' + error.message); return; }

    const newStep: VoteStep = { id: data.id, title: newCategoryTitle, digits: 2, enabled: true, sort_order: voteSteps.length, candidates: [] };
    setVoteSteps([...voteSteps, newStep]);
    setEnabledCategories([...enabledCategories, newCategoryTitle]);
    setEditingCategoryIndex(voteSteps.length);
    setEditCategoryData({ title: newCategoryTitle, digits: 2 });
  };

  const resetUrna = () => {
    setStepIndex(0);
    setIsFinished(false);
    handleCorrige();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-zinc-400 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-400 font-bold uppercase text-sm tracking-widest">Carregando Urna...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-0 md:p-4 bg-zinc-950 overflow-hidden">
      <div className="bg-zinc-300 p-2 sm:p-4 md:p-8 rounded-none md:rounded-xl shadow-2xl flex flex-col md:flex-row gap-2 sm:gap-4 md:gap-8 max-w-5xl w-full h-screen md:h-auto border-none md:border-4 border-zinc-400">

        {/* Screen Section */}
        <div className="flex-[1.2] md:flex-1 bg-zinc-100 border-4 border-zinc-400 rounded shadow-inner min-h-[250px] md:min-h-[400px] flex flex-col relative overflow-hidden">
          {isFinished ? (
            <div className="flex-1 flex items-center justify-center bg-zinc-100">
              <motion.h1
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-9xl font-bold text-zinc-800 tracking-tighter"
              >
                FIM
              </motion.h1>
              <button
                onClick={resetUrna}
                className="absolute bottom-4 right-4 text-xs text-zinc-400 hover:text-zinc-600 uppercase tracking-widest"
              >
                Reiniciar
              </button>
            </div>
          ) : isConfigPromptOpen ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-100">
              <h2 className="text-3xl font-black text-zinc-900 uppercase mb-4">Configurações</h2>
              <p className="text-xl font-bold text-zinc-700 mb-8">Deseja abrir as configurações?</p>
              <div className="flex gap-4">
                <div className="text-xs font-bold text-zinc-500">
                  <p>CONFIRMA para SIM</p>
                  <p>CORRIGE para NÃO</p>
                </div>
              </div>
            </div>
          ) : isConfigMode ? (
            <div className="flex-1 p-6 bg-zinc-100 overflow-y-auto flex flex-col">
              <div className="flex gap-4 mb-6 border-b-2 border-zinc-300 items-center">
                <button
                  onClick={() => setConfigTab('candidates')}
                  className={`pb-2 px-2 font-black uppercase text-sm transition-colors ${configTab === 'candidates' ? 'border-b-4 border-zinc-800 text-zinc-900' : 'text-zinc-400'}`}
                >
                  Candidatos
                </button>
                <button
                  onClick={() => setConfigTab('categories')}
                  className={`pb-2 px-2 font-black uppercase text-sm transition-colors ${configTab === 'categories' ? 'border-b-4 border-zinc-800 text-zinc-900' : 'text-zinc-400'}`}
                >
                  Categorias
                </button>


              </div>

              {configTab === 'candidates' ? (
                !isShowingNewCandidateForm ? (
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-black text-zinc-900 uppercase">Candidatos</h2>
                      <button onClick={() => setIsShowingNewCandidateForm(true)} className="bg-zinc-800 text-white px-4 py-2 text-xs font-bold uppercase hover:bg-zinc-700 transition-colors shadow-sm">
                        Novo Candidato
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                      {voteSteps.map((step, stepIndex) => (
                        <div key={step.title} className="bg-white border-2 border-zinc-300 p-4">
                          <h3 className="font-black text-zinc-800 uppercase mb-3 text-sm border-b-2 border-zinc-100 pb-2">{step.title}</h3>

                          {step.candidates.length === 0 ? (
                            <p className="text-xs text-zinc-500 font-bold uppercase py-2">Nenhum candidato cadastrado</p>
                          ) : (
                            <div className="space-y-3">
                              {step.candidates.map((c, candidateIndex) => (
                                <div key={c.number} className={`flex gap-4 items-center p-2 border border-zinc-200 transition-colors ${c.suspended ? 'bg-red-50 opacity-75' : 'bg-zinc-50'}`}>
                                  <div className="relative">
                                    <img src={c.photo} alt={c.name} className={`w-12 h-16 object-cover bg-zinc-200 border border-zinc-300 ${c.suspended ? 'grayscale' : ''}`} referrerPolicy="no-referrer" />
                                    {c.suspended && (
                                      <div className="absolute inset-0 bg-red-900/50 flex items-center justify-center">
                                        <Ban className="w-6 h-6 text-white" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`font-bold uppercase text-sm leading-tight truncate ${c.suspended ? 'text-red-900 line-through' : 'text-zinc-900'}`}>{c.name}</p>
                                    <p className="text-[10px] font-bold text-zinc-500 uppercase">{c.number} - {c.party}</p>
                                    {(c.age || c.activity) && (
                                      <p className="text-[10px] font-bold text-zinc-400 uppercase mt-1 truncate">
                                        {c.age ? `${c.age} ANOS` : ''} {c.age && c.activity ? '•' : ''} {c.activity || ''}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-end gap-2 pr-2 border-l border-zinc-200 pl-4">
                                    <div className="text-right">
                                      <p className="text-[10px] font-bold text-zinc-500 uppercase">Votos</p>
                                      <p className="font-black text-emerald-600 text-xl leading-none">{c.votes || 0}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => toggleSuspendCandidate(stepIndex, candidateIndex)}
                                        className={`p-1.5 rounded-full transition-colors ${c.suspended ? 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300' : 'bg-orange-100 text-orange-600 hover:bg-orange-200'}`}
                                        title={c.suspended ? "Reativar Candidato" : "Suspender Candidato"}
                                      >
                                        <Ban className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => removeCandidate(stepIndex, candidateIndex)}
                                        className="p-1.5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                        title="Remover Candidato"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 flex justify-between items-center mt-auto border-t border-zinc-300">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase">Aperte CORRIGE para sair</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-black text-zinc-900 uppercase">Novo Candidato</h2>
                      <button onClick={() => setIsShowingNewCandidateForm(false)} className="text-zinc-500 hover:text-zinc-800 font-bold text-xs uppercase underline">Voltar para lista</button>
                    </div>
                    <form onSubmit={addCandidate} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase">Nome</label>
                        <input
                          type="text"
                          value={newCandidate.name}
                          onChange={e => setNewCandidate({ ...newCandidate, name: e.target.value })}
                          className="w-full bg-white border-2 border-zinc-300 p-2 font-bold uppercase focus:border-zinc-800 outline-none text-black"
                          placeholder="Nome do Candidato"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 uppercase">Número</label>
                          <input
                            type="text"
                            value={newCandidate.number}
                            onChange={e => setNewCandidate({ ...newCandidate, number: e.target.value.replace(/\D/g, '') })}
                            className="w-full bg-white border-2 border-zinc-300 p-2 font-bold focus:border-zinc-800 outline-none text-black"
                            placeholder="Ex: 1234"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 uppercase">Partido</label>
                          <input
                            type="text"
                            value={newCandidate.party}
                            onChange={e => setNewCandidate({ ...newCandidate, party: e.target.value })}
                            className="w-full bg-white border-2 border-zinc-300 p-2 font-bold uppercase focus:border-zinc-800 outline-none text-black"
                            placeholder="Ex: PDS"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 uppercase">Idade (Opcional)</label>
                          <input
                            type="text"
                            value={newCandidate.age}
                            onChange={e => setNewCandidate({ ...newCandidate, age: e.target.value.replace(/\D/g, '') })}
                            className="w-full bg-white border-2 border-zinc-300 p-2 font-bold focus:border-zinc-800 outline-none text-black"
                            placeholder="Ex: 45"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 uppercase">Atividade (Opcional)</label>
                          <input
                            type="text"
                            value={newCandidate.activity}
                            onChange={e => setNewCandidate({ ...newCandidate, activity: e.target.value })}
                            className="w-full bg-white border-2 border-zinc-300 p-2 font-bold uppercase focus:border-zinc-800 outline-none text-black"
                            placeholder="Ex: Advogado"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Foto do Candidato (Opcional)</label>

                        {!newCandidate.photo ? (
                          <div
                            className="w-full bg-white border-2 border-dashed border-zinc-300 p-6 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-800 transition-colors"
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onClick={() => document.getElementById('photo-upload')?.click()}
                          >
                            <Upload className="w-8 h-8 text-zinc-400 mb-2" />
                            <p className="text-xs font-bold text-zinc-500 uppercase text-center">Clique ou arraste a imagem<br />aqui (.png, .jpg)</p>
                            <input
                              id="photo-upload"
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                            />
                          </div>
                        ) : (
                          <div className="relative w-32 h-40 border-2 border-zinc-300 bg-white">
                            <img src={newCandidate.photo} alt="Pré-visualização" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setNewCandidate({ ...newCandidate, photo: '' })}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="pt-4 flex justify-between items-center">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase">Aperte CORRIGE para sair</p>
                        <button
                          type="submit"
                          className="bg-zinc-800 text-white px-6 py-2 font-bold uppercase hover:bg-zinc-700 transition-colors"
                        >
                          Salvar
                        </button>
                      </div>
                    </form>
                  </>
                )
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-black text-zinc-900 uppercase">Categorias Ativas</h2>
                    <button onClick={addCategory} className="bg-zinc-800 text-white px-4 py-2 text-xs font-bold uppercase hover:bg-zinc-700 transition-colors shadow-sm">
                      Nova Categoria
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 font-bold uppercase mb-4">Selecione as categorias que aparecerão na votação:</p>
                  <div className="space-y-2 flex-1">
                    {voteSteps.map((step, index) => (
                      <div key={index} className="flex flex-col bg-white border-2 border-zinc-300 transition-colors">
                        {editingCategoryIndex === index ? (
                          <div className="p-3 space-y-3 bg-zinc-50 border-b-2 border-zinc-200">
                            <div>
                              <label className="block text-xs font-bold text-zinc-500 uppercase">Nome da Categoria</label>
                              <input
                                type="text"
                                value={editCategoryData.title}
                                onChange={e => setEditCategoryData({ ...editCategoryData, title: e.target.value })}
                                className="w-full border-2 border-zinc-300 p-1 text-sm font-bold uppercase focus:border-zinc-800 outline-none mt-1 text-black"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-zinc-500 uppercase">Quantidade de Dígitos</label>
                              <input
                                type="number"
                                value={editCategoryData.digits}
                                onChange={e => setEditCategoryData({ ...editCategoryData, digits: parseInt(e.target.value) || 0 })}
                                className="w-full border-2 border-zinc-300 p-1 text-sm font-bold focus:border-zinc-800 outline-none mt-1 text-black"
                                min="1" max="6"
                              />
                            </div>
                            <div className="flex gap-2 pt-2">
                              <button onClick={() => saveCategory(index)} className="flex-1 bg-green-500 text-zinc-900 font-bold uppercase text-xs py-2 hover:bg-green-600 shadow-sm border-b-2 border-green-700 active:translate-y-[1px] active:border-b-0">
                                Salvar
                              </button>
                              <button onClick={() => setEditingCategoryIndex(null)} className="flex-1 bg-zinc-300 text-zinc-700 font-bold uppercase text-xs py-2 hover:bg-zinc-400 shadow-sm border-b-2 border-zinc-400 active:translate-y-[1px] active:border-b-0">
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 flex items-center justify-between group">
                            <label className="flex items-center gap-3 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={enabledCategories.includes(step.title)}
                                onChange={() => {
                                  if (enabledCategories.includes(step.title)) {
                                    if (enabledCategories.length > 1) {
                                      setEnabledCategories(enabledCategories.filter(c => c !== step.title));
                                    } else {
                                      alert("Pelo menos uma categoria deve estar ativa.");
                                    }
                                  } else {
                                    setEnabledCategories([...enabledCategories, step.title]);
                                  }
                                }}
                                className="w-5 h-5 accent-zinc-800"
                              />
                              <div>
                                <span className="block font-bold text-zinc-800 uppercase leading-none">{step.title}</span>
                                <span className="text-[10px] text-zinc-500 font-bold uppercase">{step.digits} dígitos</span>
                              </div>
                            </label>

                            <button
                              onClick={() => handleEditCategory(index)}
                              className="text-zinc-400 hover:text-zinc-800 p-2 rounded transition-colors"
                              title="Editar Categoria"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 flex justify-between items-center">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Aperte CORRIGE para sair</p>
                    <p className="text-[10px] text-zinc-800 font-black uppercase">Alterações salvas automaticamente</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <p className="text-sm font-bold text-zinc-600 uppercase mb-1">Seu voto para</p>
                  <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">{currentStep.title}</h2>
                </div>
                {candidate && (
                  <div className="w-24 h-32 bg-white border-2 border-zinc-300 shadow-sm overflow-hidden">
                    <img src={candidate.photo} alt={candidate.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                )}
              </div>

              <div className="flex gap-2 mb-8">
                {Array.from({ length: currentStep.digits }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-10 h-12 border-2 border-zinc-400 flex items-center justify-center text-3xl font-bold bg-white text-black
                      ${digits.length === i ? 'border-zinc-800' : ''}`}
                  >
                    {digits[i] || (digits.length === i ? <span className="cursor-blink">|</span> : '')}
                  </div>
                ))}
              </div>

              {isWhiteVote && (
                <div className="flex-1 flex items-center justify-center">
                  <h3 className="text-4xl font-black text-zinc-900 uppercase">VOTO EM BRANCO</h3>
                </div>
              )}

              {isInvalidVote && (
                <div className="mt-4">
                  <p className="text-lg font-bold text-zinc-800">NÚMERO ERRADO</p>
                  <h3 className="text-4xl font-black text-zinc-900 uppercase mt-2">VOTO NULO</h3>
                </div>
              )}

              {candidate && (
                <div className="mt-4 space-y-2">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase font-bold">Nome</p>
                    <p className="text-xl font-bold text-zinc-900 uppercase">{candidate.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase font-bold">Partido</p>
                    <p className="text-lg font-bold text-zinc-900 uppercase">{candidate.party}</p>
                  </div>
                  {candidate.vice && (
                    <div>
                      <p className="text-xs text-zinc-500 uppercase font-bold">Vice-Candidato</p>
                      <p className="text-lg font-bold text-zinc-900 uppercase">{candidate.vice}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-auto pt-4 border-t border-zinc-300">
                <AnimatePresence>
                  {showInstructions && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] leading-tight text-zinc-700 font-bold"
                    >
                      <p>APERTE A TECLA:</p>
                      <p><span className="text-green-600">VERDE</span> PARA CONFIRMAR ESTE VOTO</p>
                      <p><span className="text-orange-600">LARANJA</span> PARA REINICIAR ESTE VOTO</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* Keypad Section */}
        <div className="w-full md:w-80 flex-1 md:flex-none bg-zinc-800 p-4 md:p-6 rounded-lg shadow-2xl flex flex-col justify-evenly md:justify-start gap-3 md:gap-6 border-b-8 border-zinc-900 overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((num, idx) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                className={`h-14 bg-zinc-900 text-white text-2xl font-bold rounded shadow-lg active:shadow-inner active:translate-y-0.5 transition-all border-b-4 border-black
                  ${num === '0' ? 'col-start-2' : ''}`}
              >
                {num}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <button
              onClick={handleBranco}
              className="h-12 bg-white text-zinc-900 text-[10px] font-black uppercase rounded shadow-lg active:shadow-inner active:translate-y-0.5 transition-all border-b-4 border-zinc-300"
            >
              Branco
            </button>
            <button
              onClick={handleCorrige}
              className="h-12 bg-orange-500 text-zinc-900 text-[10px] font-black uppercase rounded shadow-lg active:shadow-inner active:translate-y-0.5 transition-all border-b-4 border-orange-700"
            >
              Corrige
            </button>
            <button
              onClick={handleConfirma}
              className="h-16 bg-green-500 text-zinc-900 text-[12px] font-black uppercase rounded shadow-lg active:shadow-inner active:translate-y-0.5 transition-all border-b-4 border-green-700 -mt-4"
            >
              Confirma
            </button>
          </div>

          <div className="mt-auto flex justify-center">
            <div className="text-zinc-500 font-black text-xl tracking-widest opacity-20 select-none">
              JUSTIÇA ELEITORAL
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
