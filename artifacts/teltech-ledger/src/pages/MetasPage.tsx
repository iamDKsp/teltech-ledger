import React, { useState, useEffect } from 'react';
import { Target, Plus, ChevronDown, ChevronRight, CheckCircle, TrendingUp, Trash2, Edit3, X, Calendar, Check, AlertCircle } from 'lucide-react';
import { API } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { backdropVariants, modalVariants, accordionVariants } from '../lib/motion';

interface Goal {
  id: string;
  title: string;
  description?: string | null;
  type: 'objective' | 'key_result';
  parentId?: string | null;
  targetValue: number;
  currentValue: number;
  unit: string;
  status: string;
  startDate?: string;
  endDate?: string;
  keyResults?: Goal[];
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  background: '#121215',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#f0f0f0',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  background: '#7C5AC2',
  border: 'none',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'background 0.2s',
};

const btnSecondary: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#ccc',
  fontSize: 13,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(5px)',
      }}
    >
      <motion.div
        variants={modalVariants}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: '92vw',
          background: '#1a1a1f',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f0f0f0' }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#888',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
      </motion.div>
    </motion.div>
  );
}

export const MetasPage: React.FC = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Modals state
  const [modalType, setModalType] = useState<'create_objective' | 'create_kr' | 'edit_kr' | 'delete' | null>(null);
  const [selectedObjective, setSelectedObjective] = useState<Goal | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState(100);
  const [currentValue, setCurrentValue] = useState(0);
  const [unit, setUnit] = useState('%');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('active');

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const response = await API.get('/api/goals');
      const list = Array.isArray(response) ? response : [];
      setGoals(list);
      // Auto-expand all objectives by default
      const defaultExpanded: Record<string, boolean> = {};
      list.forEach((g: Goal) => {
        defaultExpanded[g.id] = true;
      });
      setExpanded(prev => ({ ...defaultExpanded, ...prev }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const calcProgress = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  };

  const getObjectiveProgress = (krList: Goal[] = []) => {
    if (krList.length === 0) return 0;
    const sum = krList.reduce((acc, kr) => acc + calcProgress(kr.currentValue, kr.targetValue), 0);
    return Math.round(sum / krList.length);
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedObjective(null);
    setSelectedGoal(null);
    setFormError(null);
    setDeletePassword('');
  };

  const openCreateObjective = () => {
    setTitle('');
    setDescription('');
    setEndDate('');
    setFormError(null);
    setModalType('create_objective');
  };

  const openCreateKR = (objective: Goal) => {
    setSelectedObjective(objective);
    setTitle('');
    setDescription('');
    setCurrentValue(0);
    setTargetValue(100);
    setUnit('%');
    setFormError(null);
    setModalType('create_kr');
  };

  const openEditKR = (kr: Goal) => {
    setSelectedGoal(kr);
    setTitle(kr.title);
    setCurrentValue(kr.currentValue);
    setTargetValue(kr.targetValue);
    setUnit(kr.unit || '%');
    setStatus(kr.status || 'active');
    setFormError(null);
    setModalType('edit_kr');
  };

  const openDelete = (goal: Goal) => {
    setSelectedGoal(goal);
    setFormError(null);
    setDeletePassword('');
    setModalType('delete');
  };

  const handleSaveObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Informe o título do objetivo');
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await API.post('/api/goals', {
        title: title.trim(),
        description: description.trim() || undefined,
        type: 'objective',
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      });
      await fetchGoals();
      closeModal();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao criar objetivo');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSaveKR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObjective) return;
    if (!title.trim()) {
      setFormError('Informe a descrição do resultado-chave');
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await API.post('/api/goals', {
        title: title.trim(),
        type: 'key_result',
        parentId: selectedObjective.id,
        currentValue: Number(currentValue) || 0,
        targetValue: Number(targetValue) || 1,
        unit: unit.trim() || '%',
      });
      await fetchGoals();
      closeModal();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao adicionar Key Result');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateKR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await API.put(`/api/goals/${selectedGoal.id}`, {
        title: title.trim(),
        currentValue: Number(currentValue) || 0,
        targetValue: Number(targetValue) || 1,
        unit: unit.trim() || '%',
        status,
      });
      await fetchGoals();
      closeModal();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao atualizar Key Result');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedGoal) return;
    if (deletePassword.trim() !== '1234') {
      setFormError('Senha incorreta! Digite 1234 para autorizar a exclusão.');
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await API.delete(`/api/goals/${selectedGoal.id}`);
      await fetchGoals();
      closeModal();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao excluir');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px', margin: '0 auto', color: '#fafafa', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(124, 90, 194, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target style={{ color: '#7C5AC2' }} size={24} />
            </div>
            Metas & OKRs
          </h1>
          <p style={{ margin: 0, color: '#a1a1aa', fontSize: '14px' }}>Acompanhe os objetivos estratégicos e resultados-chave do negócio.</p>
        </div>
        <button
          onClick={openCreateObjective}
          style={{
            backgroundColor: '#7C5AC2',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background 0.2s',
            boxShadow: '0 4px 14px rgba(124, 90, 194, 0.35)',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#6A4CA8')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#7C5AC2')}
        >
          <Plus size={18} />
          Nova Meta
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#a1a1aa' }}>Carregando metas...</div>
      ) : goals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', backgroundColor: '#161618', borderRadius: '14px', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <Target size={48} style={{ color: '#7C5AC2', opacity: 0.6, marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>Nenhum OKR definido ainda</h3>
          <p style={{ margin: '0 0 20px 0', color: '#a1a1aa', fontSize: '14px' }}>Crie seu primeiro objetivo estratégico e alinhe resultados-chave mensuráveis.</p>
          <button onClick={openCreateObjective} style={{ ...btnPrimary, margin: '0 auto' }}>
            <Plus size={16} /> Criar Primeiro Objetivo
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {goals.map(obj => {
            const isExpanded = !!expanded[obj.id];
            const progress = getObjectiveProgress(obj.keyResults);
            
            return (
              <div key={obj.id} style={{ backgroundColor: '#17171a', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                {/* Objective Header */}
                <div 
                  style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                  onClick={() => toggleExpand(obj.id)}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ marginRight: '16px', color: '#888' }}>
                    <ChevronDown size={20} style={{ transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)', transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ backgroundColor: 'rgba(124, 90, 194, 0.15)', color: '#a78bfa', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em' }}>
                        OBJETIVO
                      </span>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f5f5f5' }}>{obj.title}</h3>
                    </div>
                    {obj.description && (
                      <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#888' }}>{obj.description}</p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: '#71717a' }}>
                      {obj.endDate && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={13} />
                          Prazo: {new Date(obj.endDate).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      <span>{(obj.keyResults?.length || 0)} resultado(s)-chave</span>
                    </div>
                  </div>
                  
                  {/* Progress Bar & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginLeft: '24px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ width: '160px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                        <span style={{ color: '#888' }}>Progresso</span>
                        <span style={{ fontWeight: 600, color: progress === 100 ? '#10B981' : '#a78bfa' }}>{progress}%</span>
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', backgroundColor: progress === 100 ? '#10B981' : '#7C5AC2', width: `${progress}%`, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>

                    <button
                      onClick={() => openDelete(obj)}
                      title="Excluir Objetivo"
                      style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#666')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Key Results */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key={`kr-${obj.id}`}
                      variants={accordionVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '18px 24px 20px 52px', backgroundColor: '#131316' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <h4 style={{ margin: 0, fontSize: '12px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                        Resultados-Chave ({(obj.keyResults?.length || 0)})
                      </h4>
                      <button 
                        onClick={() => openCreateKR(obj)}
                        style={{ 
                          background: 'rgba(124, 90, 194, 0.1)', border: '1px solid rgba(124, 90, 194, 0.25)', 
                          color: '#c4b5fd', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124, 90, 194, 0.2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(124, 90, 194, 0.1)')}
                      >
                        <Plus size={14} /> Adicionar KR
                      </button>
                    </div>

                    {(!obj.keyResults || obj.keyResults.length === 0) ? (
                      <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.06)', fontSize: 13, color: '#777', textAlign: 'center' }}>
                        Nenhum resultado-chave cadastrado para este objetivo.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {obj.keyResults.map(kr => {
                          const krProgress = calcProgress(kr.currentValue, kr.targetValue);
                          return (
                            <div key={kr.id} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#1a1a1e', padding: '12px 18px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', transition: 'border-color 0.2s' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                  {krProgress === 100 ? <CheckCircle size={16} color="#10B981" /> : <TrendingUp size={16} color="#7C5AC2" />}
                                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#f0f0f0' }}>{kr.title}</span>
                                  {kr.status === 'completed' && (
                                    <span style={{ fontSize: 10, background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>CONCLUÍDO</span>
                                  )}
                                </div>
                                <div style={{ fontSize: '12px', color: '#888', marginLeft: '24px' }}>
                                  Atual: <strong style={{ color: '#ddd' }}>{kr.currentValue} {kr.unit}</strong> / Meta: <strong style={{ color: '#ddd' }}>{kr.targetValue} {kr.unit}</strong>
                                </div>
                              </div>

                              <div style={{ width: '130px', marginRight: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: krProgress === 100 ? '#10B981' : '#f0f0f0' }}>
                                  {krProgress}%
                                </div>
                                <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', backgroundColor: krProgress === 100 ? '#10B981' : '#7C5AC2', width: `${krProgress}%`, transition: 'width 0.5s ease' }} />
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  onClick={() => openEditKR(kr)}
                                  title="Editar Progresso"
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#aaa', cursor: 'pointer', padding: '6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                                  onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  onClick={() => openDelete(kr)}
                                  title="Excluir KR"
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#aaa', cursor: 'pointer', padding: '6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                                  onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
            );
          })}
        </div>
      )}

      {/* ── Modals with AnimatePresence ── */}
      <AnimatePresence>
        {modalType === 'create_objective' && (
          <Modal key="modal-create-obj" title="Novo Objetivo Estratégico" onClose={closeModal}>
          {formError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
              {formError}
            </div>
          )}
          <form onSubmit={handleSaveObjective} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Título do Objetivo *</label>
              <input
                type="text"
                placeholder="Ex: Atingir sustentabilidade e tração no produto"
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={inputStyle}
                autoFocus
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Descrição / Contexto (opcional)</label>
              <textarea
                placeholder="Explique o impacto ou direcionamento deste objetivo para a equipe..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Prazo Estimado (opcional)</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button type="button" onClick={closeModal} style={btnSecondary}>Cancelar</button>
              <button type="submit" disabled={formLoading} style={btnPrimary}>
                {formLoading ? 'Salvando...' : 'Criar Objetivo'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Criar Key Result ── */}
      {modalType === 'create_kr' && selectedObjective && (
        <Modal key="modal-create-kr" title={`Adicionar KR — ${selectedObjective.title}`} onClose={closeModal}>
          {formError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
              {formError}
            </div>
          )}
          <form onSubmit={handleSaveKR} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Descrição do Resultado-Chave *</label>
              <input
                type="text"
                placeholder="Ex: Obter 15 clientes pagantes recorrentes"
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={inputStyle}
                autoFocus
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Valor Atual</label>
                <input
                  type="number"
                  value={currentValue}
                  onChange={e => setCurrentValue(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Valor Alvo *</label>
                <input
                  type="number"
                  value={targetValue}
                  onChange={e => setTargetValue(Number(e.target.value))}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Unidade</label>
                <input
                  type="text"
                  placeholder="%, R$, un"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button type="button" onClick={closeModal} style={btnSecondary}>Cancelar</button>
              <button type="submit" disabled={formLoading} style={btnPrimary}>
                {formLoading ? 'Salvando...' : 'Adicionar Resultado'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Editar Key Result ── */}
      {modalType === 'edit_kr' && selectedGoal && (
        <Modal key="modal-edit-kr" title="Atualizar Progresso do KR" onClose={closeModal}>
          {formError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
              {formError}
            </div>
          )}
          <form onSubmit={handleUpdateKR} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Título do KR</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Valor Atual</label>
                <input
                  type="number"
                  value={currentValue}
                  onChange={e => setCurrentValue(Number(e.target.value))}
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>Meta / Alvo</label>
                <input
                  type="number"
                  value={targetValue}
                  onChange={e => setTargetValue(Number(e.target.value))}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Unidade</label>
                <input
                  type="text"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                style={inputStyle}
              >
                <option value="active">Em andamento (Ativo)</option>
                <option value="completed">Concluído</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button type="button" onClick={closeModal} style={btnSecondary}>Cancelar</button>
              <button type="submit" disabled={formLoading} style={btnPrimary}>
                {formLoading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Confirmação de Exclusão ── */}
      {modalType === 'delete' && selectedGoal && (
        <Modal key="modal-delete" title="Confirmar Exclusão" onClose={closeModal}>
          {formError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
              {formError}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, color: '#ccc', fontSize: 14 }}>
              Tem certeza que deseja excluir <strong>{selectedGoal.title}</strong>?
              {selectedGoal.type === 'objective' && ' Todos os resultados-chave associados também serão excluídos.'}
            </p>
            <div style={{ marginTop: 4 }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#ccc', marginBottom: 6 }}>
                Digite a senha para autorizar a exclusão (Senha: 1234):
              </label>
              <input
                type="password"
                autoFocus
                placeholder="Digite a senha (1234)"
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  if (formError) setFormError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleDelete();
                  }
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: '#18181b',
                  border: `1px solid ${formError ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
                  color: '#fafafa',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button type="button" onClick={closeModal} style={btnSecondary}>Cancelar</button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={formLoading}
                style={{ ...btnPrimary, background: '#ef4444' }}
              >
                {formLoading ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      </AnimatePresence>
    </div>
  );
};

