import React, { useState, useEffect } from 'react';
import { Activity, CheckSquare, Clock, AlertTriangle, Users, Briefcase, TrendingUp } from 'lucide-react';
import { API } from '../lib/api';
import { useIsMobile } from '../hooks/use-mobile';

interface Stats {
  tasksOverview: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
  };
  tasksByMember: Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
    assignedTasks: number;
    completedTasks: number;
    completionRate: number;
  }>;
  projectsSummary: Array<{
    id: string;
    name: string;
    color: string;
    progress: number;
    taskCount: number;
  }>;
  weeklyTrend: Array<{
    label: string;
    completions: number;
  }>;
}

export const PainelPage: React.FC = () => {
  const isMobile = useIsMobile();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await API.get('/api/workspace/stats');
      setStats(response);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#a1a1aa' }}>
        Carregando painel global...
      </div>
    );
  }

  const {
    tasksOverview,
    tasksByMember = [],
    projectsSummary = [],
    weeklyTrend = [],
  } = stats;

  const maxCompletions = Math.max(...weeklyTrend.map(d => d.completions), 10);

  return (
    <div
      className="responsive-page-pad"
      style={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '16px' : '24px',
        padding: 'clamp(14px, 2.5vw, 28px)',
        paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 28px)' : '32px',
        boxSizing: 'border-box',
        color: '#fafafa',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Title & Subtitle */}
      <div>
        <h1
          style={{
            fontSize: 'clamp(20px, 3.5vw, 26px)',
            fontWeight: 700,
            margin: '0 0 6px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#fff',
            letterSpacing: '-0.02em',
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #7C5AC2 0%, #4F2D8A 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(124,90,194,0.3)',
              flexShrink: 0,
            }}
          >
            <Activity size={18} />
          </div>
          Painel Global
        </h1>
        <p style={{ margin: 0, color: '#a1a1aa', fontSize: '14px' }}>
          Visão geral da produtividade e saúde dos projetos da Teltech.
        </p>
      </div>

      {/* Top 4 Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: isMobile ? '10px' : '14px',
        }}
      >
        {[
          { label: 'Total Tarefas', value: tasksOverview.total, icon: <Briefcase size={18} color="#a1a1aa" />, bg: 'rgba(255,255,255,0.04)', color: '#fff' },
          { label: 'Concluídas', value: tasksOverview.completed, icon: <CheckSquare size={18} color="#10B981" />, bg: 'rgba(16, 185, 129, 0.1)', color: '#10B981' },
          { label: 'Em Andamento', value: tasksOverview.inProgress, icon: <Clock size={18} color="#7C5AC2" />, bg: 'rgba(124, 90, 194, 0.1)', color: '#A78BFA' },
          { label: 'Atrasadas', value: tasksOverview.overdue, icon: <AlertTriangle size={18} color="#ef4444" />, bg: 'rgba(239, 68, 68, 0.1)', color: tasksOverview.overdue > 0 ? '#ef4444' : '#fafafa' },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              backgroundColor: '#18181c',
              padding: isMobile ? '12px 14px' : '16px 18px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            }}
          >
            <div
              style={{
                width: isMobile ? 36 : 40,
                height: isMobile ? 36 : 40,
                borderRadius: '10px',
                backgroundColor: stat.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {stat.icon}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: '#a1a1aa', fontSize: isMobile ? '11px' : '12px', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: 700, color: stat.color }}>
                {stat.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Team Performance & Projects Health */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: isMobile ? '16px' : '20px',
        }}
      >
        {/* Card 1: Team Performance */}
        <div
          style={{
            backgroundColor: '#18181c',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: isMobile ? '16px 14px' : '22px 20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 700,
              margin: '0 0 16px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#fff',
            }}
          >
            <Users size={18} color="#7C5AC2" />
            Desempenho da Equipe
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {tasksByMember.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#777', padding: '24px 0', fontSize: '13px' }}>
                Nenhum membro com tarefas atribuídas.
              </div>
            ) : (
              tasksByMember.map((member) => (
                <div
                  key={member.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '10px' : '14px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: '#313136',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                      fontWeight: 700,
                      color: '#fff',
                      fontSize: '14px',
                    }}
                  >
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      member.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: '#fafafa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {member.name}
                      </span>
                      <span style={{ fontSize: '12px', color: '#888', flexShrink: 0, marginLeft: 8 }}>
                        {member.completedTasks} / {member.assignedTasks} tarefas
                      </span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: '#2b2b2e', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          backgroundColor: '#7C5AC2',
                          width: `${member.completionRate}%`,
                          borderRadius: '3px',
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ width: '42px', textAlign: 'right', fontWeight: 700, fontSize: '13px', color: '#10B981', flexShrink: 0 }}>
                    {member.completionRate}%
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card 2: Projects Health */}
        <div
          style={{
            backgroundColor: '#18181c',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: isMobile ? '16px 14px' : '22px 20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 700,
              margin: '0 0 16px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#fff',
            }}
          >
            <TrendingUp size={18} color="#10B981" />
            Saúde dos Projetos
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {projectsSummary.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#777', padding: '24px 0', fontSize: '13px' }}>
                Nenhum projeto cadastrado no workspace.
              </div>
            ) : (
              projectsSummary.map((proj) => (
                <div
                  key={proj.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: proj.color || '#7C5AC2', flexShrink: 0 }} />
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#fafafa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {proj.name}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#888', flexShrink: 0, marginLeft: 8 }}>
                      {proj.taskCount} {proj.taskCount === 1 ? 'tarefa' : 'tarefas'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, height: '6px', backgroundColor: '#2b2b2e', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          backgroundColor: proj.progress >= 70 ? '#10B981' : proj.progress < 30 ? '#ef4444' : '#7C5AC2',
                          width: `${proj.progress}%`,
                          borderRadius: '3px',
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, width: '36px', textAlign: 'right', color: '#ccc', flexShrink: 0 }}>
                      {proj.progress}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Card 3: Weekly Trend Chart (Tarefas Concluídas - 7 dias) */}
      <div
        style={{
          backgroundColor: '#18181c',
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: isMobile ? '16px 14px' : '22px 24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#fff' }}>
              Tarefas Concluídas (Últimos 7 dias)
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#888' }}>
              Ritmo de entrega diário da equipe no período
            </p>
          </div>
          <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 600, background: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: 6 }}>
            {weeklyTrend.reduce((acc, curr) => acc + curr.completions, 0)} entregas
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            height: '170px',
            paddingTop: '16px',
            gap: isMobile ? '6px' : '14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            paddingBottom: '10px',
          }}
        >
          {weeklyTrend.map((day, i) => {
            const heightPct = Math.max((day.completions / maxCompletions) * 100, 4);
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div style={{ fontSize: '11px', color: day.completions > 0 ? '#10B981' : '#666', fontWeight: 600 }}>
                  {day.completions}
                </div>
                <div
                  style={{
                    width: '100%',
                    maxWidth: isMobile ? '28px' : '36px',
                    height: '110px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${heightPct}%`,
                      background: day.completions > 0 ? 'linear-gradient(180deg, #10B981 0%, rgba(16,185,129,0.5) 100%)' : 'transparent',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.5s ease',
                    }}
                  />
                </div>
                <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#888', fontWeight: 500 }}>
                  {day.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
