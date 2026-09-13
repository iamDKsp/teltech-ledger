import React, { useState, useEffect } from 'react';
import { Target, Plus, ChevronDown, ChevronRight, CheckCircle, TrendingUp } from 'lucide-react';
import { API } from '../lib/api';

interface Goal {
  id: string;
  title: string;
  description: string;
  type: 'objective' | 'key_result';
  targetValue: number;
  currentValue: number;
  unit: string;
  status: string;
  startDate?: string;
  endDate?: string;
  keyResults?: Goal[];
}

export const MetasPage: React.FC = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const { data } = await API.get('/api/goals');
      setGoals(data);
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

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: '#fafafa', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 600, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Target style={{ color: '#7C5AC2' }} size={28} />
            Metas & OKRs
          </h1>
          <p style={{ margin: 0, color: '#a1a1aa' }}>Acompanhe os objetivos da empresa e resultados-chave.</p>
        </div>
        <button
          style={{
            backgroundColor: '#7C5AC2', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px',
            fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#6A4CA8')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#7C5AC2')}
        >
          <Plus size={18} />
          Nova Meta
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#a1a1aa' }}>Carregando metas...</div>
      ) : goals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', backgroundColor: '#1a1a1a', borderRadius: '12px', border: '1px dashed #313136' }}>
          <Target size={48} style={{ color: '#313136', marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Nenhuma meta definida ainda</h3>
          <p style={{ margin: 0, color: '#a1a1aa' }}>Crie seu primeiro OKR para começar a alinhar seu time.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {goals.map(obj => {
            const isExpanded = expanded[obj.id];
            const progress = getObjectiveProgress(obj.keyResults);
            
            return (
              <div key={obj.id} style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', border: '1px solid #242424', overflow: 'hidden' }}>
                {/* Objective Header */}
                <div 
                  style={{ padding: '20px', display: 'flex', alignItems: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                  onClick={() => toggleExpand(obj.id)}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#232326')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ marginRight: '16px', color: '#a1a1aa' }}>
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ backgroundColor: 'rgba(124, 90, 194, 0.1)', color: '#7C5AC2', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                        OBJECTIVE
                      </span>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>{obj.title}</h3>
                    </div>
                    {obj.endDate && (
                      <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
                        Prazo: {new Date(obj.endDate).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                  
                  {/* Progress Ring / Bar */}
                  <div style={{ width: '150px', marginLeft: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span style={{ color: '#a1a1aa' }}>Progresso</span>
                      <span style={{ fontWeight: 500, color: progress === 100 ? '#10B981' : '#fafafa' }}>{progress}%</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: '#313136', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', backgroundColor: progress === 100 ? '#10B981' : '#7C5AC2', width: `${progress}%`, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                </div>

                {/* Key Results */}
                {isExpanded && obj.keyResults && (
                  <div style={{ borderTop: '1px solid #242424', padding: '16px 20px 16px 52px', backgroundColor: '#141414' }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Key Results ({obj.keyResults.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {obj.keyResults.map(kr => {
                        const krProgress = calcProgress(kr.currentValue, kr.targetValue);
                        return (
                          <div key={kr.id} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#1a1a1a', padding: '12px 16px', borderRadius: '8px', border: '1px solid #242424' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                {krProgress === 100 ? <CheckCircle size={16} color="#10B981" /> : <TrendingUp size={16} color="#7C5AC2" />}
                                <span style={{ fontSize: '14px', fontWeight: 500 }}>{kr.title}</span>
                              </div>
                              <div style={{ fontSize: '12px', color: '#a1a1aa', marginLeft: '24px' }}>
                                Atual: {kr.currentValue} {kr.unit} / Meta: {kr.targetValue} {kr.unit}
                              </div>
                            </div>
                            <div style={{ width: '120px' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px', fontSize: '12px', fontWeight: 500 }}>
                                {krProgress}%
                              </div>
                              <div style={{ height: '6px', backgroundColor: '#313136', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', backgroundColor: krProgress === 100 ? '#10B981' : '#7C5AC2', width: `${krProgress}%`, transition: 'width 0.5s ease' }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <button style={{ 
                        marginTop: '8px', alignSelf: 'flex-start', background: 'transparent', border: '1px dashed #313136', 
                        color: '#a1a1aa', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px'
                      }}>
                        <Plus size={14} /> Adicionar KR
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
