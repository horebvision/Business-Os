'use client';

import { useState } from 'react';

// ==============================================================================
// BUSINESSOS — PAGE AIDE & SUPPORT (/help) — PHASE 6
// ==============================================================================

const FAQ_ITEMS = [
  {
    category: 'Démarrage',
    icon: '🚀',
    questions: [
      {
        q: 'Comment créer mon premier devis ?',
        a: 'Allez dans Finance → Devis → Nouveau devis. Sélectionnez un client existant ou créez-en un, ajoutez vos articles, et cliquez sur Envoyer. Le client recevra un email avec le devis en PDF.',
      },
      {
        q: 'Comment ajouter des membres à mon équipe ?',
        a: 'Dans Paramètres → Équipe → Inviter un membre. Entrez l\'adresse email et choisissez le rôle (Gestionnaire, Commercial, Comptable…). Un email d\'invitation est envoyé automatiquement.',
      },
      {
        q: 'Comment importer mes clients existants ?',
        a: 'Dans CRM → Clients → Importer CSV. Téléchargez le modèle, remplissez-le avec vos données (nom, email, téléphone, ville) et importez-le. Maximum 500 lignes par import.',
      },
    ],
  },
  {
    category: 'Facturation',
    icon: '💼',
    questions: [
      {
        q: 'Comment convertir un devis accepté en facture ?',
        a: 'Sur la page détail d\'un devis accepté, cliquez sur "Convertir en facture". La facture reprend automatiquement tous les articles et les informations client.',
      },
      {
        q: 'Quels modes de paiement sont disponibles ?',
        a: 'BusinessOS supporte Stripe (carte bancaire, SEPA), Wave, Orange Money et MTN MoMo. Les passerelles disponibles dépendent de votre configuration dans Paramètres → Paiements.',
      },
      {
        q: 'Comment envoyer une relance automatique ?',
        a: 'Dans Finance → Relances, vous pouvez configurer des relances automatiques J+7, J+14 et J+30 après l\'échéance. Elles s\'envoient par email et/ou WhatsApp selon votre configuration.',
      },
    ],
  },
  {
    category: 'WhatsApp & Communication',
    icon: '💬',
    questions: [
      {
        q: 'Comment envoyer une facture par WhatsApp ?',
        a: 'Sur la page détail d\'une facture, cliquez sur l\'icône WhatsApp. Si WhatsApp Cloud API est configuré, le message part automatiquement. Sinon, un lien WhatsApp s\'ouvre pour l\'envoyer manuellement.',
      },
      {
        q: 'Comment configurer WhatsApp Cloud API ?',
        a: 'Créez une application Meta Business sur developers.facebook.com, ajoutez le produit WhatsApp Business, et copiez le Phone Number ID et le Access Token dans vos variables d\'environnement (WHATSAPP_PHONE_NUMBER_ID et WHATSAPP_ACCESS_TOKEN).',
      },
    ],
  },
  {
    category: 'Abonnements & Facturation',
    icon: '💳',
    questions: [
      {
        q: 'Comment changer de plan ?',
        a: 'Dans Paramètres → Abonnement → Changer de plan. Choisissez le plan souhaité (Starter, Business, Pro) et la périodicité (mensuel ou annuel). Le changement est immédiat.',
      },
      {
        q: 'L\'essai gratuit de 14 jours nécessite-t-il une carte ?',
        a: 'Non. L\'essai de 14 jours est entièrement gratuit et sans carte bancaire. Vous n\'êtes prélevé qu\'après la fin de la période d\'essai, si vous choisissez un plan payant.',
      },
      {
        q: 'Mes données sont-elles préservées si j\'annule ?',
        a: 'Oui. En cas d\'annulation, votre compte passe en mode lecture seule. Vous conservez un accès en lecture à toutes vos données pendant 30 jours pour les exporter.',
      },
    ],
  },
  {
    category: 'Sécurité & Données',
    icon: '🔒',
    questions: [
      {
        q: 'Mes données sont-elles isolées des autres entreprises ?',
        a: 'Absolument. BusinessOS utilise une architecture multi-tenant stricte avec Row Level Security (RLS) Supabase. Chaque donnée est associée à un company_id unique et les requêtes sont filtrées automatiquement.',
      },
      {
        q: 'Puis-je exporter toutes mes données ?',
        a: 'Oui. Dans Paramètres → Données → Exporter. Vous pouvez exporter vos clients, prospects, devis et factures en CSV à tout moment.',
      },
    ],
  },
];

const CONTACT_CHANNELS = [
  {
    icon: '📧',
    title: 'Email Support',
    description: 'Réponse sous 24h en jours ouvrés',
    action: 'support@businessos.app',
    href: 'mailto:support@businessos.app',
    color: '#2563eb',
  },
  {
    icon: '💬',
    title: 'WhatsApp Support',
    description: 'Réponse rapide pour les urgences',
    action: 'Ouvrir WhatsApp',
    href: 'https://wa.me/message/businessos-support',
    color: '#25d366',
  },
  {
    icon: '📖',
    title: 'Documentation',
    description: 'Guides complets et tutoriels vidéo',
    action: 'Voir la doc',
    href: '#',
    color: '#7c3aed',
  },
];

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFaq = searchQuery
    ? FAQ_ITEMS.map((cat) => ({
        ...cat,
        questions: cat.questions.filter(
          (q) =>
            q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
            q.a.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((cat) => cat.questions.length > 0)
    : FAQ_ITEMS;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

      {/* ── En-tête ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
        padding: '60px 24px',
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛟</div>
        <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 12px' }}>
          Centre d'aide BusinessOS
        </h1>
        <p style={{ fontSize: '16px', opacity: 0.8, margin: '0 0 32px' }}>
          Trouvez des réponses à vos questions ou contactez notre équipe
        </p>

        {/* Barre de recherche */}
        <div style={{ maxWidth: '520px', margin: '0 auto', position: 'relative' }}>
          <span style={{
            position: 'absolute', left: '16px', top: '50%',
            transform: 'translateY(-50%)', fontSize: '18px', pointerEvents: 'none',
          }}>🔍</span>
          <input
            type="text"
            placeholder="Rechercher une question..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 20px 14px 48px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '15px',
              background: 'rgba(255,255,255,0.95)',
              color: '#1e293b',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px' }}>

        {/* ── Canaux de contact ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
          marginBottom: '48px',
        }}>
          {CONTACT_CHANNELS.map((ch) => (
            <a
              key={ch.title}
              href={ch.href}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block',
                background: '#fff',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                textDecoration: 'none',
                border: `2px solid transparent`,
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = ch.color;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${ch.color}20`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>{ch.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b', marginBottom: '4px' }}>
                {ch.title}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
                {ch.description}
              </div>
              <div style={{
                display: 'inline-block',
                padding: '6px 14px',
                borderRadius: '8px',
                background: ch.color + '15',
                color: ch.color,
                fontSize: '13px',
                fontWeight: 600,
              }}>
                {ch.action} →
              </div>
            </a>
          ))}
        </div>

        {/* ── FAQ ── */}
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#1e293b', marginBottom: '24px' }}>
          Questions fréquentes
        </h2>

        {filteredFaq.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '48px',
            background: '#fff', borderRadius: '16px',
            color: '#64748b', fontSize: '15px',
          }}>
            Aucune question ne correspond à &laquo;&nbsp;{searchQuery}&nbsp;&raquo;.<br />
            Contactez notre support via email ou WhatsApp.
          </div>
        )}

        {filteredFaq.map((category) => (
          <div key={category.category} style={{ marginBottom: '32px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              marginBottom: '16px',
            }}>
              <span style={{ fontSize: '20px' }}>{category.icon}</span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#334155', margin: 0 }}>
                {category.category}
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {category.questions.map((item) => {
                const key = `${category.category}-${item.q}`;
                const isOpen = openFaq === key;

                return (
                  <div
                    key={key}
                    style={{
                      background: '#fff',
                      borderRadius: '12px',
                      border: `1px solid ${isOpen ? '#7c3aed30' : '#e2e8f0'}`,
                      overflow: 'hidden',
                      transition: 'all 0.2s',
                      boxShadow: isOpen ? '0 2px 12px rgba(124,58,237,0.08)' : 'none',
                    }}
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : key)}
                      style={{
                        width: '100%',
                        padding: '16px 20px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        textAlign: 'left',
                        gap: '12px',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                        {item.q}
                      </span>
                      <span style={{
                        fontSize: '18px',
                        color: '#7c3aed',
                        transform: isOpen ? 'rotate(45deg)' : 'none',
                        transition: 'transform 0.2s',
                        flexShrink: 0,
                      }}>
                        +
                      </span>
                    </button>
                    {isOpen && (
                      <div style={{
                        padding: '0 20px 16px',
                        fontSize: '14px',
                        color: '#475569',
                        lineHeight: 1.7,
                        borderTop: '1px solid #f1f5f9',
                      }}>
                        <div style={{ paddingTop: '12px' }}>{item.a}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* ── CTA support ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b, #4c1d95)',
          borderRadius: '20px',
          padding: '36px',
          textAlign: 'center',
          color: '#fff',
          marginTop: '48px',
        }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>💡</div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>
            Vous ne trouvez pas votre réponse ?
          </h3>
          <p style={{ opacity: 0.8, marginBottom: '24px', fontSize: '14px' }}>
            Notre équipe support répond en moins de 24h par email ou WhatsApp.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <a
              href="mailto:support@businessos.app"
              style={{
                padding: '12px 24px',
                background: '#fff',
                color: '#4c1d95',
                borderRadius: '10px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              📧 Envoyer un email
            </a>
            <a
              href="https://wa.me/message/businessos"
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '12px 24px',
                background: '#25d36620',
                color: '#fff',
                borderRadius: '10px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '14px',
                border: '1px solid #25d36640',
              }}
            >
              💬 WhatsApp Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
