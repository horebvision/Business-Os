import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { companyId } = await req.json();

    if (!companyId) {
      return NextResponse.json({ error: "Identifiant d'entreprise manquant" }, { status: 400 });
    }

    // Check if the user is a member of this company
    const { data: membership } = await supabase
      .from('company_members')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Accès non autorisé à cette entreprise' }, { status: 403 });
    }

    // Try RPC first if available, otherwise run direct comprehensive seed
    const { error: rpcErr } = await supabase.rpc('seed_company_demo_data', {
      p_company_id: companyId,
      p_user_id: user.id,
    });

    // 1. Seed 8 Real Customers
    const customerSeedData = [
      { name: 'Amadou Diallo', company_name: 'Sahel Distribution SARL', email: 'a.diallo@saheldistrib.sn', phone: '+221 77 123 45 67', city: 'Dakar', country: 'Sénégal', status: 'actif' },
      { name: 'Kouassi Konan', company_name: 'Ivoire Logistique Express', email: 'k.konan@ivoirelog.ci', phone: '+225 07 45 67 89', city: 'Abidjan', country: 'Côte d\'Ivoire', status: 'actif' },
      { name: 'Aïssatou Bamba', company_name: 'Baobab Digital Agency', email: 'contact@baobab-digital.sn', phone: '+221 78 987 65 43', city: 'Dakar', country: 'Sénégal', status: 'actif' },
      { name: 'Yves Kotto', company_name: 'Kotto & Frères BTP', email: 'yves@kottobtp.cm', phone: '+237 699 12 34 56', city: 'Douala', country: 'Cameroun', status: 'actif' },
      { name: 'Mariam Traoré', company_name: 'Sika Agro Industries', email: 'm.traore@sika-agro.ml', phone: '+223 66 11 22 33', city: 'Bamako', country: 'Mali', status: 'actif' },
      { name: 'Koffi Mensah', company_name: 'Atlantic Maritime Solutions', email: 'koffi@atlantic-togo.tg', phone: '+228 90 22 33 44', city: 'Lomé', country: 'Togo', status: 'actif' },
      { name: 'Fatou Ndiaye', company_name: 'Teranga Solar Energy', email: 'f.ndiaye@terangasolar.sn', phone: '+221 76 543 21 00', city: 'Thiès', country: 'Sénégal', status: 'actif' },
      { name: 'Christian Dossou', company_name: 'Bénin Import & Transit', email: 'dossou@benintransit.bj', phone: '+229 97 88 99 00', city: 'Cotonou', country: 'Bénin', status: 'actif' },
    ];

    const insertedCustomers: any[] = [];
    for (const c of customerSeedData) {
      const { data: cust } = await supabase
        .from('customers')
        .insert({
          company_id: companyId,
          name: c.name,
          company_name: c.company_name,
          email: c.email,
          phone: c.phone,
          city: c.city,
          created_by: user.id,
        })
        .select()
        .single();
      if (cust) insertedCustomers.push(cust);
    }

    const c1 = insertedCustomers[0] || { id: null, name: 'Client A' };
    const c2 = insertedCustomers[1] || { id: null, name: 'Client B' };
    const c3 = insertedCustomers[2] || { id: null, name: 'Client C' };
    const c4 = insertedCustomers[3] || { id: null, name: 'Client D' };
    const c5 = insertedCustomers[4] || { id: null, name: 'Client E' };
    const c6 = insertedCustomers[5] || { id: null, name: 'Client F' };
    const c7 = insertedCustomers[6] || { id: null, name: 'Client G' };
    const c8 = insertedCustomers[7] || { id: null, name: 'Client H' };

    // 2. Seed 12 Prospects (Leads)
    const leadsSeed = [
      { first_name: 'Mamadou', last_name: 'Diop', company_name: 'Omni Telecom Dakar', email: 'm.diop@omnitelecom.sn', phone: '+221 77 001 02 03', status: 'Nouveau', estimated_value: 3500000, source: 'Site Web' },
      { first_name: 'Clarisse', last_name: 'Koffi', company_name: 'Cocody Consulting', email: 'c.koffi@cocody.ci', phone: '+225 05 12 34 56', status: 'Contacté', estimated_value: 2000000, source: 'LinkedIn' },
      { first_name: 'Ousmane', last_name: 'Sow', company_name: 'Cap Vert Énergie', email: 'osow@capvert.sn', phone: '+221 78 111 22 33', status: 'Qualifié', estimated_value: 8000000, source: 'Recommandation' },
      { first_name: 'Grace', last_name: 'Tchouassi', company_name: 'Douala Tech Hub', email: 'grace@doualatech.cm', phone: '+237 677 88 99 00', status: 'Proposition', estimated_value: 5000000, source: 'Salon Pro' },
      { first_name: 'Patrick', last_name: 'Assogba', company_name: 'Marina Transit Cotonou', email: 'p.assogba@marina.bj', phone: '+229 96 11 22 33', status: 'Négociation', estimated_value: 12000000, source: 'Prospection' },
      { first_name: 'Hawa', last_name: 'Camara', company_name: 'Guinée Mines & Services', email: 'h.camara@guineemines.gn', phone: '+224 622 33 44 55', status: 'Gagné', estimated_value: 15000000, source: 'Appel d\'offres' },
      { first_name: 'Séraphin', last_name: 'Dossou', company_name: 'Cotonou Pharma', email: 'dossou@c-pharma.bj', phone: '+229 95 00 11 22', status: 'Perdu', estimated_value: 1500000, source: 'Site Web' },
      { first_name: 'Ndeye', last_name: 'Seck', company_name: 'Almadies Hospitality Group', email: 'nseck@almadies.sn', phone: '+221 77 444 55 66', status: 'Nouveau', estimated_value: 4500000, source: 'Bouche à oreille' },
      { first_name: 'David', last_name: 'Akakpo', company_name: 'Lomé Sécurité & Réseaux', email: 'david@lomesecur.tg', phone: '+228 91 33 44 55', status: 'Qualifié', estimated_value: 3000000, source: 'LinkedIn' },
      { first_name: 'Chantal', last_name: 'Gbagbo', company_name: 'Ivoire Textile & Mode', email: 'c.gbagbo@ivoiretextile.ci', phone: '+225 01 23 45 67', status: 'Proposition', estimated_value: 6500000, source: 'Salon Pro' },
      { first_name: 'Boubacar', last_name: 'Keïta', company_name: 'Mali BTP Construction', email: 'b.keita@malibtp.ml', phone: '+223 76 99 88 77', status: 'Négociation', estimated_value: 18000000, source: 'Appel entrant' },
      { first_name: 'Aminata', last_name: 'Touré', company_name: 'Dakar FinTech Solutions', email: 'atoure@dakarfintech.sn', phone: '+221 70 888 99 00', status: 'Nouveau', estimated_value: 7000000, source: 'Partenaire' },
    ];

    for (const l of leadsSeed) {
      await supabase.from('leads').insert({
        company_id: companyId,
        first_name: l.first_name,
        last_name: l.last_name,
        company_name: l.company_name,
        email: l.email,
        phone: l.phone,
        status: l.status,
        estimated_value: l.estimated_value,
        currency: 'FCFA',
        source: l.source,
        created_by: user.id,
      });
    }

    // Helper dates
    const today = new Date();
    const dStr = (offsetDays: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().split('T')[0];
    };

    // 3. Seed 10 Quotes (Devis)
    const quoteSeedData = [
      { num: 'DEV-2026-0001', cust: c1, status: 'Accepté', sub: 5000000, tax: 0, disc: 0, tot: 5000000, date: dStr(-40), exp: dStr(-10), obj: 'Déploiement ERP & Infrastructure Cloud' },
      { num: 'DEV-2026-0002', cust: c2, status: 'Accepté', sub: 2500000, tax: 0, disc: 0, tot: 2500000, date: dStr(-35), exp: dStr(-5), obj: 'Audit de sécurité & Refonte réseau' },
      { num: 'DEV-2026-0003', cust: c3, status: 'Accepté', sub: 1500000, tax: 0, disc: 0, tot: 1500000, date: dStr(-30), exp: dStr(-2), obj: 'Campagne Digitale & Identité de Marque' },
      { num: 'DEV-2026-0004', cust: c4, status: 'Accepté', sub: 4200000, tax: 0, disc: 0, tot: 4200000, date: dStr(-25), exp: dStr(5), obj: 'Système de gestion de flotte BTP' },
      { num: 'DEV-2026-0005', cust: c5, status: 'Envoyé', sub: 3200000, tax: 0, disc: 0, tot: 3200000, date: dStr(-8), exp: dStr(22), obj: 'Automatisation logistique agricole' },
      { num: 'DEV-2026-0006', cust: c6, status: 'Consulté', sub: 6000000, tax: 0, disc: 0, tot: 6000000, date: dStr(-5), exp: dStr(25), obj: 'Plateforme de traçabilité maritime' },
      { num: 'DEV-2026-0007', cust: c7, status: 'Brouillon', sub: 1800000, tax: 0, disc: 0, tot: 1800000, date: dStr(-2), exp: dStr(28), obj: 'Installation solaire connectée' },
      { num: 'DEV-2026-0008', cust: c8, status: 'Refusé', sub: 4500000, tax: 0, disc: 0, tot: 4500000, date: dStr(-20), exp: dStr(-1), obj: 'Solution de dédouanement automatisé' },
      { num: 'DEV-2026-0009', cust: c1, status: 'Envoyé', sub: 2100000, tax: 0, disc: 0, tot: 2100000, date: dStr(-4), exp: dStr(26), obj: 'Maintenance annuelle & infogérance' },
      { num: 'DEV-2026-0010', cust: c2, status: 'Brouillon', sub: 3000000, tax: 0, disc: 0, tot: 3000000, date: dStr(0), exp: dStr(30), obj: 'Module de télécollecte Mobile Money' },
    ];

    const insertedQuotes: any[] = [];
    for (const q of quoteSeedData) {
      if (!q.cust?.id) continue;
      const { data: quote } = await supabase
        .from('quotes')
        .insert({
          company_id: companyId,
          customer_id: q.cust.id,
          quote_number: q.num,
          issue_date: q.date,
          expiration_date: q.exp,
          status: q.status,
          subtotal: q.sub,
          tax_amount: q.tax,
          discount_amount: q.disc,
          total: q.tot,
          currency: 'FCFA',
          terms: '30 jours',
          notes: 'Devis valable 30 jours à compter de la date d\'émission.',
          created_by: user.id,
        })
        .select()
        .single();

      if (quote) {
        insertedQuotes.push(quote);
        // Insert line item
        await supabase.from('quote_items').insert({
          quote_id: quote.id,
          description: q.obj,
          quantity: 1,
          unit_price: q.sub,
          total: q.tot,
          sort_order: 1,
        });
      }
    }

    // 4. Seed 7 Invoices (including partially paid and overdue)
    const invoiceSeedData = [
      // FAC 1: 5 000 000 FCFA (Scenario Test ABC: 2M + 3M = 5M => Payée)
      { num: 'FAC-2026-0001', cust: c1, quoteId: insertedQuotes[0]?.id, issue: dStr(-35), due: dStr(-5), tot: 5000000, paid: 5000000, status: 'Payée', obj: 'Déploiement ERP & Infrastructure Cloud' },
      // FAC 2: 2 500 000 FCFA (Partiellement payée: 1 500 000 payés, reste 1 000 000)
      { num: 'FAC-2026-0002', cust: c2, quoteId: insertedQuotes[1]?.id, issue: dStr(-28), due: dStr(2), tot: 2500000, paid: 1500000, status: 'Partiellement payée', obj: 'Audit de sécurité & Refonte réseau' },
      // FAC 3: 1 500 000 FCFA (En retard: échéance il y a 12 jours, 0 payé)
      { num: 'FAC-2026-0003', cust: c3, quoteId: insertedQuotes[2]?.id, issue: dStr(-25), due: dStr(-12), tot: 1500000, paid: 0, status: 'En retard', obj: 'Campagne Digitale & Identité de Marque' },
      // FAC 4: 4 200 000 FCFA (En retard critique: échéance il y a 20 jours, 1 200 000 payés, reste 3 000 000)
      { num: 'FAC-2026-0004', cust: c4, quoteId: insertedQuotes[3]?.id, issue: dStr(-30), due: dStr(-20), tot: 4200000, paid: 1200000, status: 'En retard', obj: 'Système de gestion de flotte BTP' },
      // FAC 5: 3 800 000 FCFA (Directe sans devis, Envoyée, échéance aujourd'hui)
      { num: 'FAC-2026-0005', cust: c5, quoteId: null, issue: dStr(-15), due: dStr(0), tot: 3800000, paid: 0, status: 'Envoyée', obj: 'Équipements agro-industriels livrés' },
      // FAC 6: 1 800 000 FCFA (Payée par Mobile Money)
      { num: 'FAC-2026-0006', cust: c6, quoteId: null, issue: dStr(-18), due: dStr(12), tot: 1800000, paid: 1800000, status: 'Payée', obj: 'Licence annuelle plateforme maritime' },
      // FAC 7: 950 000 FCFA (Brouillon)
      { num: 'FAC-2026-0007', cust: c7, quoteId: null, issue: dStr(-1), due: dStr(29), tot: 950000, paid: 0, status: 'Brouillon', obj: 'Fourniture onduleurs solaires' },
    ];

    const insertedInvoices: any[] = [];
    for (const inv of invoiceSeedData) {
      if (!inv.cust?.id) continue;
      const remaining = Math.max(0, inv.tot - inv.paid);
      const { data: invoice } = await supabase
        .from('invoices')
        .insert({
          company_id: companyId,
          customer_id: inv.cust.id,
          quote_id: inv.quoteId,
          invoice_number: inv.num,
          issue_date: inv.issue,
          due_date: inv.due,
          status: inv.status,
          subtotal: inv.tot,
          tax_amount: 0,
          discount_amount: 0,
          total: inv.tot,
          paid_amount: inv.paid,
          currency: 'FCFA',
          terms: '30 jours',
          notes: 'Règlement par virement bancaire ou Mobile Money.',
          created_by: user.id,
        })
        .select()
        .single();

      if (invoice) {
        insertedInvoices.push(invoice);
        // Insert line item
        await supabase.from('invoice_items').insert({
          invoice_id: invoice.id,
          description: inv.obj,
          quantity: 1,
          unit_price: inv.tot,
          total: inv.tot,
          sort_order: 1,
        });
      }
    }

    // 5. Seed Payments (Matching real paid amounts)
    // Inv 1: 2 000 000 FCFA + 3 000 000 FCFA
    if (insertedInvoices[0]) {
      await supabase.from('payments').insert({
        company_id: companyId,
        invoice_id: insertedInvoices[0].id,
        customer_id: c1.id,
        amount: 2000000,
        payment_date: dStr(-20),
        payment_method: 'Virement bancaire',
        reference: 'VIR-SN-99881',
        notes: 'Acompte 40% démarrage',
        created_by: user.id,
      });

      await supabase.from('payments').insert({
        company_id: companyId,
        invoice_id: insertedInvoices[0].id,
        customer_id: c1.id,
        amount: 3000000,
        payment_date: dStr(-7),
        payment_method: 'Virement bancaire',
        reference: 'VIR-SN-99940',
        notes: 'Solde final 60%',
        created_by: user.id,
      });
    }

    // Inv 2: 1 500 000 FCFA
    if (insertedInvoices[1]) {
      await supabase.from('payments').insert({
        company_id: companyId,
        invoice_id: insertedInvoices[1].id,
        customer_id: c2.id,
        amount: 1500000,
        payment_date: dStr(-10),
        payment_method: 'Chèque',
        reference: 'CHQ-SGBCI-4412',
        notes: 'Acompte validation audit',
        created_by: user.id,
      });
    }

    // Inv 4: 1 200 000 FCFA
    if (insertedInvoices[3]) {
      await supabase.from('payments').insert({
        company_id: companyId,
        invoice_id: insertedInvoices[3].id,
        customer_id: c4.id,
        amount: 1200000,
        payment_date: dStr(-22),
        payment_method: 'Mobile Money',
        reference: 'OM-DLA-77821',
        notes: 'Orange Money Douala',
        created_by: user.id,
      });
    }

    // Inv 6: 1 800 000 FCFA
    if (insertedInvoices[5]) {
      await supabase.from('payments').insert({
        company_id: companyId,
        invoice_id: insertedInvoices[5].id,
        customer_id: c6.id,
        amount: 1800000,
        payment_date: dStr(-8),
        payment_method: 'Mobile Money',
        reference: 'WAVE-TG-0039',
        notes: 'Règlement intégral Wave',
        created_by: user.id,
      });
    }

    // 6. Seed Activities (Journal d'audit Phase 3)
    const activitiesSeed = [
      { action: 'Devis créé', entity: 'quote', title: 'Devis DEV-2026-0001', cust: c1.id, desc: 'Devis de 5 000 000 FCFA créé pour Sahel Distribution' },
      { action: 'Devis accepté', entity: 'quote', title: 'Devis DEV-2026-0001', cust: c1.id, desc: 'Devis accepté par le client via le lien public sécurisé' },
      { action: 'Facture générée', entity: 'invoice', title: 'Facture FAC-2026-0001', cust: c1.id, desc: 'Facture FAC-2026-0001 convertie depuis le devis accepté' },
      { action: 'Paiement enregistré', entity: 'invoice', title: 'Facture FAC-2026-0001', cust: c1.id, desc: 'Acompte de 2 000 000 FCFA perçu par Virement bancaire' },
      { action: 'Paiement enregistré', entity: 'invoice', title: 'Facture FAC-2026-0001', cust: c1.id, desc: 'Solde de 3 000 000 FCFA perçu. Facture soldée.' },
      { action: 'Facture générée', entity: 'invoice', title: 'Facture FAC-2026-0003', cust: c3.id, desc: 'Facture de 1 500 000 FCFA envoyée à Baobab Digital' },
      { action: 'Relance IA générée', entity: 'invoice', title: 'Facture FAC-2026-0003', cust: c3.id, desc: 'Relance ferme générée avec l\'assistant IA pour 12 jours de retard' },
      { action: 'Paiement partiel', entity: 'invoice', title: 'Facture FAC-2026-0004', cust: c4.id, desc: 'Règlement de 1 200 000 FCFA perçu par Mobile Money (Orange Money)' },
    ];

    for (const act of activitiesSeed) {
      await supabase.from('activities').insert({
        company_id: companyId,
        user_id: user.id,
        action: act.action,
        entity_type: act.entity,
        entity_title: act.title,
        customer_id: act.cust,
        description: act.desc,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Données de démonstration Phase 3 chargées avec succès !',
      counts: {
        customers: insertedCustomers.length,
        leads: leadsSeed.length,
        quotes: insertedQuotes.length,
        invoices: insertedInvoices.length,
      },
    });
  } catch (err: any) {
    console.error('Error in demo data API:', err);
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}
