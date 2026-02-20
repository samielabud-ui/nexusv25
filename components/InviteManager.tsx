
import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  orderBy,
  runTransaction,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { UserStats } from '../types';

interface Invite {
  id: string;
  code: string;
  used: boolean;
  usedBy: string | null;
  createdBy: string;
  createdAt: any;
  usedAt: any;
  expiresAt: any;
}

interface InviteManagerProps {
  userStats: UserStats;
}

const InviteManager: React.FC<InviteManagerProps> = ({ userStats }) => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const isAdmin = userStats.role === 'admin' || userStats.adm === true;
  const hasQuota = (userStats.invitesAvailable || 0) > 0;
  const canGenerate = isAdmin || hasQuota;

  useEffect(() => {
    if (!userStats.uid) return;

    const q = query(
      collection(db, "invites"),
      where("createdBy", "==", userStats.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      } as Invite));
      setInvites(docs);
    }, (err) => {
      console.error("Erro ao carregar convites:", err);
      setError("Erro de permissão ao acessar histórico.");
    });

    return () => unsubscribe();
  }, [userStats.uid]);

  const handleGenerate = async () => {
    if (!userStats.uid || loading) return;

    setLoading(true);
    setError(null);
    setGeneratedCode(null);

    try {
      const newCode = crypto.randomUUID().split("-")[0].toUpperCase();
      const inviteRef = doc(collection(db, "invites"));
      const userRef = doc(db, "users", userStats.uid);

      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("Usuário não encontrado no sistema.");

        const userData = userSnap.data();
        if (!isAdmin && (userData.invitesAvailable || 0) <= 0) {
          throw new Error("Você não possui mais convites disponíveis.");
        }

        // Criar o convite
        transaction.set(inviteRef, {
          code: newCode,
          createdBy: userStats.uid,
          used: false,
          usedBy: null,
          createdAt: serverTimestamp(),
          usedAt: null,
          expiresAt: Timestamp.fromDate(new Date(2026, 5, 30))
        });

        // Deduzir cota se não for admin
        if (!isAdmin) {
          transaction.update(userRef, {
            invitesAvailable: 0
          });
        }
      });

      setGeneratedCode(newCode);
    } catch (err: any) {
      console.error("Falha na geração:", err);
      setError(err.message || "Erro técnico ao salvar convite.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    alert("Código " + code + " copiado!");
  };

  const formatDate = (ts: any) => {
    if (!ts) return '—';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 bg-nexus-card/30 p-2 rounded-2xl">
      <header className="pb-4 border-b border-nexus-border">
         <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🎟️</span>
            <h3 className="text-sm font-black text-white uppercase italic tracking-tight">Gestão de Convites</h3>
         </div>
         <p className="text-[10px] text-nexus-text-label font-bold uppercase tracking-widest leading-relaxed">
           Cada código gerado é único e expira após o primeiro uso.
         </p>
      </header>

      {/* ÁREA DE GERAÇÃO */}
      <div className="p-6 bg-nexus-surface border border-nexus-border rounded-3xl shadow-inner space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-[10px] font-black text-nexus-text-sec uppercase tracking-widest">Seu Saldo</p>
          {isAdmin ? (
            <span className="text-[9px] font-black bg-blue-600/20 text-blue-500 px-3 py-1 rounded-full uppercase border border-blue-600/20">Admin: Ilimitado</span>
          ) : (
            <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border ${hasQuota ? 'bg-nexus-green/10 text-nexus-green border-nexus-green/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
              {userStats.invitesAvailable || 0} disponível
            </span>
          )}
        </div>

        {/* CÓDIGO RECÉM GERADO */}
        {generatedCode && (
          <div className="bg-nexus-blue/10 border border-nexus-blue/30 p-5 rounded-2xl animate-in zoom-in duration-300 text-center space-y-3">
             <p className="text-[9px] font-black text-nexus-blue uppercase tracking-[0.2em]">Convite Gerado com Sucesso!</p>
             <div className="flex items-center justify-center gap-3">
                <span className="text-2xl font-mono font-black text-white tracking-[0.3em]">{generatedCode}</span>
                <button 
                  onClick={() => copyToClipboard(generatedCode)}
                  className="p-2 bg-nexus-blue text-black rounded-lg hover:scale-110 transition-transform shadow-lg shadow-nexus-blue/20"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </button>
             </div>
          </div>
        )}

        {canGenerate && !generatedCode ? (
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-nexus-blue text-black font-black py-4 rounded-2xl text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-nexus-blue/10 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-black" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processando...
              </>
            ) : isAdmin ? "Gerar Convite Admin" : "Gerar Meu Convite"}
          </button>
        ) : !canGenerate && !generatedCode ? (
          <div className="py-4 px-4 bg-nexus-bg/50 border border-nexus-border rounded-xl text-center">
             <p className="text-xs text-nexus-text-label font-bold italic uppercase tracking-tighter">Cota de convites esgotada.</p>
          </div>
        ) : (
          <button 
            onClick={() => setGeneratedCode(null)}
            className="w-full bg-nexus-surface border border-nexus-border text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-nexus-hover transition-all"
          >
            Gerar Outro Convite
          </button>
        )}

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <p className="text-rose-400 text-[9px] font-black text-center uppercase tracking-widest">{error}</p>
          </div>
        )}
      </div>

      {/* LISTAGEM DE HISTÓRICO */}
      {invites.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-1">
             <p className="text-[9px] font-black text-nexus-text-label uppercase tracking-widest">Meus Convites Enviados</p>
             <div className="h-px flex-grow bg-nexus-border"></div>
          </div>

          <div className="space-y-2 max-h-[250px] overflow-y-auto no-scrollbar pr-1">
            {invites.map((invite) => (
              <div key={invite.id} className="p-4 bg-nexus-surface border border-nexus-border rounded-2xl flex items-center justify-between group hover:border-nexus-blue/30 transition-all shadow-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black text-white tracking-widest select-all">{invite.code}</span>
                    {!invite.used && (
                      <button 
                        onClick={() => copyToClipboard(invite.code)}
                        className="p-1 text-nexus-text-label hover:text-white transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                      </button>
                    )}
                  </div>
                  <p className="text-[8px] text-nexus-text-label font-bold uppercase mt-1">Criado em: {formatDate(invite.createdAt)}</p>
                </div>

                <div className="flex items-center gap-3">
                  {invite.used ? (
                    <div className="flex flex-col items-end">
                       <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          <span className="text-[8px] font-black text-rose-500 uppercase">Utilizado</span>
                       </div>
                       <p className="text-[7px] text-nexus-text-label font-mono mt-0.5">{formatDate(invite.usedAt)}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-nexus-green animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
                       <span className="text-[8px] font-black text-nexus-green uppercase">Disponível</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InviteManager;
