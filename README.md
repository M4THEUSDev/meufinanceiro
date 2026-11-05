# MeuFinanceiro — iOS

App de finanças pessoais para iPhone, implementado a partir do Figma **“MeuFinanceiro — iOS App”**
(Design System, Onboarding, Login, Dashboard, Transações, Contas, Categorias, Cartões, Planejamento,
Metas, Relatórios, Configurações, Dark Mode, Estados de interface e Protótipo navegável).

Stack definida no próprio design system: **Angular 20 (standalone) + Ionic 8 + Capacitor 7**, ícones **Ionicons**,
fonte **Inter**, tokens semânticos mapeados para variáveis CSS do Ionic (claro/escuro).

## Rodando

```bash
npm install
npm start            # http://localhost:4200 (use o modo dispositivo do navegador, 393×852)
npm run test:ci      # testes unitários (Karma + Chrome headless)
npm run ios          # build + cap sync + abre o projeto no Xcode (requer macOS)
```

No primeiro acesso: Splash → Onboarding → Login. O primeiro login no aparelho define a senha local
(mín. 6 caracteres); o Face ID pode ser ativado depois em **Configurações › Segurança**.

## O que está implementado

| Fluxo (Figma · Protótipo) | Telas |
| --- | --- |
| 1 · Primeiro acesso | Splash (1,5 s), Onboarding com 3 páginas e swipe, Login (validação, mostrar senha, esqueci a senha, Face ID) |
| 2 · Cadastrar despesa | Tab bar com botão **+**, modal Nova transação (Despesa/Receita, valor com máscara BRL, categoria, conta/cartão, parcelas, data, pago, observações), toast com **Desfazer**, Dashboard atualizado |
| 3 · Consultar transações | Lista agrupada por dia, busca por descrição ou valor, chips de período/categoria/tipo, sheet de **Filtros**, itens deslizáveis (Editar/Excluir), Detalhes, Editar, alerta de exclusão |
| 4 · Gerenciar contas | Menu Mais, Minhas contas (agrupadas por tipo), Nova/Editar conta (tipo, instituição, saldo inicial, cor, incluir no total, desativar) |
| 5 · Planejamento | Orçamentos do mês (anel de uso, ritmo diário, alertas ≥ 80% e > 100%), copiar do mês anterior, Definir orçamento (sugestão pela média de 3 meses, alerta, recorrência), Acompanhar gastos |
| 6 · Metas | Lista com total acumulado, Nova meta (ícone, valor, valor inicial, data, conta), Adicionar contribuição (atalhos +100/+250/+500, conta de débito), Acompanhar progresso, metas concluídas |
| Outras | Categorias (despesas/receitas, personalizadas), Cartões (carrossel, limite, fatura, pagar fatura, parcelamentos), Relatórios (mês/trimestre/ano, evolução 12 meses, resultado líquido, rosca interativa, top 5, comparação, indicadores, exportar PDF/CSV), Configurações (foto, nome, e-mail, tema Claro/Escuro/Sistema, notificações, Face ID, bloqueio do app, senha, exportar/backup/restaurar, excluir dados, sair) |
| Estados | Listas vazias, pull-to-refresh, banner offline, erros de validação, tela de bloqueio, toasts + háptico |

Os dados ficam no aparelho (Capacitor Preferences) — o app é offline-first. Um conjunto de dados de exemplo
coerente com o Figma é carregado na primeira execução (saldos, categorias, orçamentos, metas e cartões).

## Estrutura

```
src/
  theme/variables.scss         tokens do Figma (cores claro/escuro, raios, espaçamentos, sombras)
  global.scss                  tipografia iOS, ListItem, toolbar, toasts, chips…
  app/core/                    modelos, store (signals), seed, serviços (tema, auth, bloqueio, notificações, exportação)
  app/shared/components/       componentes do design system (BalanceCard, SummaryCard, TransactionItem, BillItem,
                               BudgetProgress, GoalProgress, CategoryIcon, CurrencyInput, gráficos…)
  app/pages/                   telas
ios/                           projeto nativo (Capacitor) com ícone e splash gerados do Figma
resources/                     ícone e splash em alta resolução
```
