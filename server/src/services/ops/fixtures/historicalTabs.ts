import type { HistoricalSheetTab } from '../historicalImport.js'

/** Multi-schema fixtures representing historical FEBRACIS turma tabs (not production data). */
export const FIXTURE_HISTORICAL_TABS: HistoricalSheetTab[] = [
  {
    sourceFile: 'CONFIRMACOES_FIXTURE',
    sourceSheet: 'IF 08',
    headers: ['ALUNO', 'CPF', 'TELEFONE', 'E-MAIL', 'CONSULTOR', 'CONFIRMAÇÃO', 'PRESENÇA', '1º CONTATO'],
    rows: [
      [
        'Maria Souza',
        '529.982.247-25',
        '49999990001',
        'maria@email.com',
        'Vanessa',
        'Confirmado',
        'Sim',
        'Ligou 01/08 — interessada',
      ],
      [
        'João Lima',
        '111.444.777-35',
        '49999990002',
        'joao@email.com',
        'Lucas',
        'Aguardando',
        'Não',
        '',
      ],
      ['', '', '49999990003', '', 'Maria', '', '', 'Linha inválida'],
    ],
  },
  {
    sourceFile: 'CONFIRMACOES_FIXTURE',
    sourceSheet: 'CEOP 06',
    headers: ['CLIENTES', 'CPF/CNPJ', 'WhatsApp', 'Email', 'Status Vaga', 'GRADE', 'OBS./CONTATO', '2º CONTATO'],
    rows: [
      [
        'Ana Clara',
        '390.533.447-05',
        '49988881111',
        'ana@email.com',
        'Confirmado',
        'Green',
        'Pagamento ok',
        'Retorno WhatsApp',
      ],
      [
        'Pedro Souza',
        '390.533.447-05',
        '49988882222',
        'outro@email.com',
        'Transferencia CEOP 07',
        'Gold',
        '',
        '',
      ],
    ],
  },
  {
    sourceFile: 'CONFIRMACOES_FIXTURE',
    sourceSheet: 'ML5 04',
    headers: ['Nome', 'Documento', 'Fone', 'Consultora', 'Status', 'Presente'],
    rows: [
      ['Carla Dias', 'invalid-cpf', '49977770000', 'Kauany', 'Matriculado', 'X'],
      ['Carla Dias', '', '49977770000', 'Kauany', 'Confirmado', 'Sim'],
    ],
  },
]
