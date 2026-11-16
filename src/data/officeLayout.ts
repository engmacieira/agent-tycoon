import {
  FloorStyle,
  InteractiveObject,
  RoomConfig,
  RoomId,
  StaffRosterSlot,
  TileCoord,
  WallStyle,
} from '../types/office';

export const TILE_SIZE = 32;
export const MAP_COLS = 54;
export const MAP_ROWS = 38;

export const CEO_SPAWN_TILE: TileCoord = { x: 6, y: 6 };

export const ROOM_CONFIGS: RoomConfig[] = [
  // ================= ALA NORTE =================
  {
    id: 'diretoria',
    name: 'Sala da Diretoria',
    shortName: 'Diretoria',
    wing: 'Norte',
    floorStyle: 'wood-noble',
    accentColor: '#F59E0B',
    bounds: { x: 1, y: 1, w: 16, h: 10 },
    signTile: { x: 9, y: 11 },
    entryTile: { x: 9, y: 9 },
    capacity: 1,
    roleDescription:
      'Centro estratégico do escritório. Aqui o Dono (CEO) centraliza demandas, supervisiona o quadro de agentes e monitora o orçamento de tokens.',
    deskSlots: [
      {
        id: 'slot-ceo',
        label: 'Mesa Presidencial',
        roleTitle: 'CEO (Dono)',
        deskTile: { x: 5, y: 3 },
        seatTile: { x: 5, y: 4 },
        facing: 'down',
        occupiedByAgentId: 'ceo',
      },
    ],
  },
  {
    id: 'war-room',
    name: 'Sala de Reunião / War Room',
    shortName: 'War Room',
    wing: 'Norte',
    floorStyle: 'carpet-executive',
    accentColor: '#60A5FA',
    bounds: { x: 18, y: 1, w: 18, h: 10 },
    signTile: { x: 27, y: 11 },
    entryTile: { x: 27, y: 9 },
    capacity: 6,
    roleDescription:
      'Sala tática para alinhamentos multi-agente, planejamento de sprints, revisão de arquitetura e decisões críticas entre coordenadores.',
    deskSlots: [
      { id: 'wr-1', label: 'Assento Norte 1', roleTitle: 'Participante', deskTile: { x: 24, y: 5 }, seatTile: { x: 24, y: 4 }, facing: 'down', occupiedByAgentId: null },
      { id: 'wr-2', label: 'Assento Norte 2', roleTitle: 'Participante', deskTile: { x: 26, y: 5 }, seatTile: { x: 26, y: 4 }, facing: 'down', occupiedByAgentId: null },
      { id: 'wr-3', label: 'Assento Norte 3', roleTitle: 'Participante', deskTile: { x: 29, y: 5 }, seatTile: { x: 29, y: 4 }, facing: 'down', occupiedByAgentId: null },
      { id: 'wr-4', label: 'Assento Sul 1', roleTitle: 'Participante', deskTile: { x: 24, y: 6 }, seatTile: { x: 24, y: 7 }, facing: 'up', occupiedByAgentId: null },
      { id: 'wr-5', label: 'Assento Sul 2', roleTitle: 'Participante', deskTile: { x: 26, y: 6 }, seatTile: { x: 26, y: 7 }, facing: 'up', occupiedByAgentId: null },
      { id: 'wr-6', label: 'Assento Sul 3', roleTitle: { toString: () => 'Participante' } as unknown as string, deskTile: { x: 29, y: 6 }, seatTile: { x: 29, y: 7 }, facing: 'up', occupiedByAgentId: null },
    ],
  },
  {
    id: 'coordenadores',
    name: 'Sala dos Coordenadores',
    shortName: 'Coordenadores',
    wing: 'Norte',
    floorStyle: 'wood-light',
    accentColor: '#38BDF8',
    bounds: { x: 37, y: 1, w: 16, h: 10 },
    signTile: { x: 44, y: 11 },
    entryTile: { x: 44, y: 9 },
    capacity: 2,
    roleDescription:
      'Cabine envidraçada de gestão intermediária. Abrigará o Coordenador de Equipe (orquestração Kanban) e o Coordenador Financeiro (controle de custos).',
    deskSlots: [
      {
        id: 'coord-team',
        label: 'Estação Norte (Atlas)',
        roleTitle: 'Coordenador de Equipe',
        deskTile: { x: 43, y: 4 },
        seatTile: { x: 43, y: 3 },
        facing: 'down',
        occupiedByAgentId: 'coord-team',
      },
      {
        id: 'coord-finance',
        label: 'Estação Sul (Vega)',
        roleTitle: 'Coordenador Financeiro',
        deskTile: { x: 43, y: 5 },
        seatTile: { x: 43, y: 6 },
        facing: 'up',
        occupiedByAgentId: 'coord-finance',
      },
    ],
  },

  // ================= ALA CENTRAL =================
  {
    id: 'admin',
    name: 'Ilha Administrativo',
    shortName: 'Administrativo',
    wing: 'Central',
    floorStyle: 'carpet-admin',
    accentColor: '#64748B',
    bounds: { x: 2, y: 16, w: 9, h: 8 },
    signTile: { x: 6, y: 15 },
    entryTile: { x: 6, y: 19 },
    capacity: 3,
    roleDescription:
      'Operações documentais, triagem de contratos, organização de planilhas e suporte administrativo automatizado.',
    deskSlots: [
      { id: 'adm-1', label: 'Baia Admin 01', roleTitle: 'Agente Administrativo', deskTile: { x: 3, y: 17 }, seatTile: { x: 3, y: 18 }, facing: 'up', occupiedByAgentId: null },
      { id: 'adm-2', label: 'Baia Admin 02', roleTitle: 'Agente Administrativo', deskTile: { x: 7, y: 17 }, seatTile: { x: 7, y: 18 }, facing: 'up', occupiedByAgentId: null },
      { id: 'adm-3', label: 'Baia Admin 03', roleTitle: 'Agente Documental', deskTile: { x: 3, y: 21 }, seatTile: { x: 3, y: 22 }, facing: 'up', occupiedByAgentId: null },
    ],
  },
  {
    id: 'backend',
    name: 'Ilha Backend',
    shortName: 'Backend',
    wing: 'Central',
    floorStyle: 'carpet-backend',
    accentColor: '#10B981',
    bounds: { x: 12, y: 16, w: 9, h: 8 },
    signTile: { x: 16, y: 15 },
    entryTile: { x: 16, y: 19 },
    capacity: 3,
    roleDescription:
      'Engenharia de APIs, modelagem de dados, integrações server-side e automações de infraestrutura.',
    deskSlots: [
      { id: 'be-1', label: 'Baia Backend 01', roleTitle: 'Engenheiro Backend', deskTile: { x: 13, y: 17 }, seatTile: { x: 13, y: 18 }, facing: 'up', occupiedByAgentId: null },
      { id: 'be-2', label: 'Baia Backend 02', roleTitle: 'Arquiteto de Dados', deskTile: { x: 17, y: 17 }, seatTile: { x: 17, y: 18 }, facing: 'up', occupiedByAgentId: null },
      { id: 'be-3', label: 'Baia Backend 03', roleTitle: 'DevOps / APIs', deskTile: { x: 13, y: 21 }, seatTile: { x: 13, y: 22 }, facing: 'up', occupiedByAgentId: null },
    ],
  },
  {
    id: 'frontend',
    name: 'Ilha Frontend',
    shortName: 'Frontend',
    wing: 'Central',
    floorStyle: 'carpet-frontend',
    accentColor: '#A855F7',
    bounds: { x: 22, y: 16, w: 9, h: 8 },
    signTile: { x: 26, y: 15 },
    entryTile: { x: 26, y: 19 },
    capacity: 3,
    roleDescription:
      'Interfaces web, prototipagem de wireframes, design systems, acessibilidade e interações visuais.',
    deskSlots: [
      { id: 'fe-1', label: 'Baia Frontend 01', roleTitle: 'Engenheiro Frontend', deskTile: { x: 23, y: 17 }, seatTile: { x: 23, y: 18 }, facing: 'up', occupiedByAgentId: null },
      { id: 'fe-2', label: 'Baia Frontend 02', roleTitle: 'UI / UX Designer', deskTile: { x: 27, y: 17 }, seatTile: { x: 27, y: 18 }, facing: 'up', occupiedByAgentId: null },
      { id: 'fe-3', label: 'Baia Frontend 03', roleTitle: 'Motion & Canvas Dev', deskTile: { x: 23, y: 21 }, seatTile: { x: 23, y: 22 }, facing: 'up', occupiedByAgentId: null },
    ],
  },
  {
    id: 'marketing',
    name: 'Ilha Marketing',
    shortName: 'Marketing',
    wing: 'Central',
    floorStyle: 'carpet-marketing',
    accentColor: '#F97316',
    bounds: { x: 32, y: 16, w: 9, h: 8 },
    signTile: { x: 36, y: 15 },
    entryTile: { x: 36, y: 19 },
    capacity: 3,
    roleDescription:
      'Campanhas de crescimento, redação publicitária, posicionamento de marca e análise de funil.',
    deskSlots: [
      { id: 'mkt-1', label: 'Baia Marketing 01', roleTitle: 'Copywriter IA', deskTile: { x: 33, y: 17 }, seatTile: { x: 33, y: 18 }, facing: 'up', occupiedByAgentId: null },
      { id: 'mkt-2', label: 'Baia Marketing 02', roleTitle: 'Growth Strategist', deskTile: { x: 37, y: 17 }, seatTile: { x: 37, y: 18 }, facing: 'up', occupiedByAgentId: null },
      { id: 'mkt-3', label: 'Baia Marketing 03', roleTitle: 'Social & Conteúdo', deskTile: { x: 33, y: 21 }, seatTile: { x: 33, y: 22 }, facing: 'up', occupiedByAgentId: null },
    ],
  },
  {
    id: 'qa-lab',
    name: 'Laboratório de QA / Homologação',
    shortName: 'Lab QA',
    wing: 'Central',
    floorStyle: 'lab-tile',
    accentColor: '#EF4444',
    bounds: { x: 43, y: 16, w: 10, h: 8 },
    signTile: { x: 47, y: 15 },
    entryTile: { x: 47, y: 19 },
    capacity: 2,
    roleDescription:
      'Validação rigorosa de entregas, testes automatizados, inspeção de regressões e disparo de alertas de homologação.',
    deskSlots: [
      { id: 'qa-1', label: 'Bancada Teste A', roleTitle: 'QA Automation', deskTile: { x: 45, y: 17 }, seatTile: { x: 45, y: 18 }, facing: 'up', occupiedByAgentId: null },
      { id: 'qa-2', label: 'Bancada Teste B', roleTitle: 'Revisor de Segurança', deskTile: { x: 47, y: 17 }, seatTile: { x: 47, y: 18 }, facing: 'up', occupiedByAgentId: null },
    ],
  },

  // ================= ALA SUL =================
  {
    id: 'recepcao',
    name: 'Recepção / Onboarding',
    shortName: 'Recepção',
    wing: 'Sul',
    floorStyle: 'marble',
    accentColor: '#14B8A6',
    bounds: { x: 1, y: 29, w: 11, h: 8 },
    signTile: { x: 6, y: 28 },
    entryTile: { x: 6, y: 32 },
    capacity: 1,
    roleDescription:
      'Entrada principal do escritório. Ponto de chegada de novos agentes, triagem inicial de solicitações externas e boas-vindas.',
    deskSlots: [
      { id: 'rec-1', label: 'Balcão Principal', roleTitle: 'Agente de Triagem', deskTile: { x: 4, y: 31 }, seatTile: { x: 4, y: 30 }, facing: 'down', occupiedByAgentId: null },
    ],
  },
  {
    id: 'cpd',
    name: 'CPD / Sala de Servidores',
    shortName: 'CPD / Cofre API',
    wing: 'Sul',
    floorStyle: 'server-grid',
    accentColor: '#22C55E',
    bounds: { x: 13, y: 29, w: 9, h: 8 },
    signTile: { x: 17, y: 28 },
    entryTile: { x: 17, y: 32 },
    capacity: 0,
    roleDescription:
      'Cofre climatizado de infraestrutura e credenciais. Armazena variáveis .env, chaves de provedores LLM e telemetria de rede.',
    deskSlots: [],
  },
  {
    id: 'refeitorio',
    name: 'Refeitório / Copa / Cafeteria',
    shortName: 'Refeitório',
    wing: 'Sul',
    floorStyle: 'checkerboard',
    accentColor: '#F59E0B',
    bounds: { x: 23, y: 29, w: 11, h: 8 },
    signTile: { x: 30, y: 28 },
    entryTile: { x: 29, y: 31 },
    capacity: 4,
    roleDescription:
      'Área de alimentação e pausa para café expresso. Espaço para recarga de energia entre ciclos intensos de tarefas.',
    deskSlots: [],
  },
  {
    id: 'recreacao',
    name: 'Sala de Recreação',
    shortName: 'Recreação',
    wing: 'Sul',
    floorStyle: 'lounge-cork',
    accentColor: '#EC4899',
    bounds: { x: 35, y: 29, w: 9, h: 8 },
    signTile: { x: 39, y: 28 },
    entryTile: { x: 38, y: 31 },
    capacity: 0,
    roleDescription:
      'Espaço de descompressão com fliperama 8-bits, mesa de ping-pong, sofá e pufes para descanso dos agentes.',
    deskSlots: [],
  },
  {
    id: 'banheiro',
    name: 'Banheiro / Vestiário',
    shortName: 'Banheiro',
    wing: 'Sul',
    floorStyle: 'bathroom-tile',
    accentColor: '#0EA5E9',
    bounds: { x: 45, y: 29, w: 8, h: 8 },
    signTile: { x: 47, y: 28 },
    entryTile: { x: 47, y: 31 },
    capacity: 0,
    roleDescription:
      'Instalações sanitárias e vestiário com fileira de armários individuais (lockers) e pias com espelhos.',
    deskSlots: [],
  },
];

// Fix War Room slot 6 roleTitle cleanly
ROOM_CONFIGS[1].deskSlots[5].roleTitle = 'Participante';

export const PLANNED_STAFF_ROSTER: StaffRosterSlot[] = [
  { slotNumber: 1, title: 'CEO (Dono)', roomId: 'diretoria', roomName: 'Diretoria', status: 'active', agentName: 'Dono' },
  { slotNumber: 2, title: 'Coordenador de Equipe', roomId: 'coordenadores', roomName: 'Coordenadores', status: 'active', agentName: 'Atlas' },
  { slotNumber: 3, title: 'Coordenador Financeiro', roomId: 'coordenadores', roomName: 'Coordenadores', status: 'active', agentName: 'Vega' },
  { slotNumber: 4, title: 'Agente Administrativo 01', roomId: 'admin', roomName: 'Administrativo', status: 'vacant' },
  { slotNumber: 5, title: 'Agente Administrativo 02', roomId: 'admin', roomName: 'Administrativo', status: 'vacant' },
  { slotNumber: 6, title: 'Engenheiro Backend 01', roomId: 'backend', roomName: 'Backend', status: 'vacant' },
  { slotNumber: 7, title: 'Engenheiro Backend 02', roomId: 'backend', roomName: 'Backend', status: 'vacant' },
  { slotNumber: 8, title: 'DevOps / APIs', roomId: 'backend', roomName: 'Backend', status: 'vacant' },
  { slotNumber: 9, title: 'Engenheiro Frontend 01', roomId: 'frontend', roomName: 'Frontend', status: 'vacant' },
  { slotNumber: 10, title: 'UI / UX Designer', roomId: 'frontend', roomName: 'Frontend', status: 'vacant' },
  { slotNumber: 11, title: 'Copywriter / Growth', roomId: 'marketing', roomName: 'Marketing', status: 'vacant' },
  { slotNumber: 12, title: 'Social & Campanhas', roomId: 'marketing', roomName: 'Marketing', status: 'vacant' },
  { slotNumber: 13, title: 'QA Automation', roomId: 'qa-lab', roomName: 'Lab QA', status: 'vacant' },
  { slotNumber: 14, title: 'Agente de Onboarding', roomId: 'recepcao', roomName: 'Recepção', status: 'vacant' },
];

function makeRectTiles(x: number, y: number, w: number, h: number): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      tiles.push({ x: x + dx, y: y + dy });
    }
  }
  return tiles;
}

function obj(
  id: string,
  roomId: RoomId,
  type: InteractiveObject['type'],
  label: string,
  description: string,
  x: number,
  y: number,
  w = 1,
  h = 1,
  solid = true,
  interactive = true,
  specialAction?: InteractiveObject['specialAction']
): InteractiveObject {
  return {
    id,
    roomId,
    type,
    label,
    description,
    anchor: { x, y },
    widthTiles: w,
    heightTiles: h,
    tiles: makeRectTiles(x, y, w, h),
    solid,
    interactive,
    specialAction,
  };
}

export const FURNITURE_OBJECTS: InteractiveObject[] = [
  // 1. SALA DA DIRETORIA
  obj('dir-desk-h', 'diretoria', 'ceo-desk-h', 'Mesa Executiva em L', 'Mesa ampla em L do CEO em madeira nobre.', 3, 3, 4, 1, true, true, 'ceo-console'),
  obj('dir-desk-v', 'diretoria', 'ceo-desk-v', 'Extensão da Mesa em L', 'Ala lateral da mesa presidencial para documentos.', 3, 4, 1, 2, true, false),
  obj('dir-console', 'diretoria', 'ceo-console', 'Console de Ordens', 'Terminal central da Diretoria para demandas, equipe e tokens.', 5, 3, 1, 1, true, true, 'ceo-console'),
  obj('dir-chair', 'diretoria', 'ceo-chair', 'Cadeira Presidencial', 'Poltrona ergonômica de couro do CEO.', 5, 4, 1, 1, false, false),
  obj('dir-bookshelf', 'diretoria', 'bookshelf-trophy', 'Estante de Livros e Troféus', 'Biblioteca executiva com prêmios de entregas e manuais.', 10, 1, 4, 1, true, true),
  obj('dir-plant', 'diretoria', 'plant-tall', 'Vaso Decorativo', 'Ficus ornamental da Diretoria.', 15, 2, 1, 1, true, false),
  obj('dir-guest-1', 'diretoria', 'guest-chair', 'Poltrona de Reunião', 'Assento para visitantes na Diretoria.', 11, 6, 1, 1, false, false),
  obj('dir-coffee', 'diretoria', 'coffee-table', 'Mesa de Apoio', 'Mesa de centro para reuniões rápidas com o CEO.', 12, 6, 1, 1, true, false),
  obj('dir-guest-2', 'diretoria', 'guest-chair', 'Poltrona de Reunião', 'Assento para visitantes na Diretoria.', 13, 6, 1, 1, false, false),

  // 2. WAR ROOM
  obj('wr-projector', 'war-room', 'projector-screen', 'Tela de Projeção Tática', 'Painel amplo para diagramas de arquitetura e métricas.', 24, 1, 6, 1, true, true),
  obj('wr-whiteboard', 'war-room', 'whiteboard', 'Quadro Branco', 'Anotações de fluxo e backlog estratégico.', 19, 1, 2, 1, true, true),
  obj('wr-water', 'war-room', 'water-cooler', 'Bebedouro', 'Água gelada para longas reuniões.', 34, 2, 1, 1, true, false),
  obj('wr-table-l', 'war-room', 'oval-table-left', 'Mesa Oval (Ala Oeste)', 'Mesa longa de reuniões para até 6 participantes.', 23, 5, 1, 2, true, true),
  obj('wr-table-m', 'war-room', 'oval-table-mid', 'Mesa Oval Central', 'Mesa longa de reuniões para alinhamento de sprints.', 24, 5, 5, 2, true, true),
  obj('wr-table-r', 'war-room', 'oval-table-right', 'Mesa Oval (Ala Leste)', 'Mesa longa de reuniões para até 6 participantes.', 29, 5, 1, 2, true, true),
  obj('wr-c1', 'war-room', 'office-chair-down', 'Cadeira War Room', 'Assento 01 da sala de reunião.', 24, 4, 1, 1, false, false),
  obj('wr-c2', 'war-room', 'office-chair-down', 'Cadeira War Room', 'Assento 02 da sala de reunião.', 26, 4, 1, 1, false, false),
  obj('wr-c3', 'war-room', 'office-chair-down', 'Cadeira War Room', 'Assento 03 da sala de reunião.', 29, 4, 1, 1, false, false),
  obj('wr-c4', 'war-room', 'office-chair-up', 'Cadeira War Room', 'Assento 04 da sala de reunião.', 24, 7, 1, 1, false, false),
  obj('wr-c5', 'war-room', 'office-chair-up', 'Cadeira War Room', 'Assento 05 da sala de reunião.', 26, 7, 1, 1, false, false),
  obj('wr-c6', 'war-room', 'office-chair-up', 'Cadeira War Room', 'Assento 06 da sala de reunião.', 29, 7, 1, 1, false, false),

  // 3. SALA DOS COORDENADORES
  obj('coord-kanban', 'coordenadores', 'kanban-board', 'Painel Kanban Colorido', 'Quadro visual de tarefas: A Fazer, Em Progresso, QA e Concluído.', 41, 1, 6, 1, true, true, 'kanban'),
  obj('coord-desk-1', 'coordenadores', 'coord-desk', 'Mesa — Coordenador de Equipe', 'Estação reservada ao Coordenador de Equipe (Fase 2).', 42, 4, 3, 1, true, true),
  obj('coord-desk-2', 'coordenadores', 'coord-desk', 'Mesa — Coordenador Financeiro', 'Estação reservada ao Coordenador Financeiro (Fase 2).', 42, 5, 3, 1, true, true),
  obj('coord-chair-1', 'coordenadores', 'office-chair-down', 'Cadeira Coord. Equipe', 'Assento do Coordenador de Equipe.', 43, 3, 1, 1, false, false),
  obj('coord-chair-2', 'coordenadores', 'office-chair-up', 'Cadeira Coord. Financeiro', 'Assento do Coordenador Financeiro.', 43, 6, 1, 1, false, false),
  obj('coord-cabinet', 'coordenadores', 'filing-cabinet', 'Arquivo de Orçamentos', 'Armário metálico de registros operacionais.', 50, 2, 2, 1, true, false),
  obj('coord-plant', 'coordenadores', 'plant-tall', 'Planta Ornamental', 'Samambaia de escritório.', 38, 2, 1, 1, true, false),

  // 4. ILHA ADMINISTRATIVO
  obj('adm-d1', 'admin', 'desk-admin', 'Baia Administrativo 01', 'Estação com terminal de planilhas e documentos.', 3, 17, 2, 1, true, true),
  obj('adm-c1', 'admin', 'office-chair-up', 'Cadeira Admin 01', 'Assento da baia 01.', 3, 18, 1, 1, false, false),
  obj('adm-d2', 'admin', 'desk-admin', 'Baia Administrativo 02', 'Estação de triagem e cadastros.', 7, 17, 2, 1, true, true),
  obj('adm-c2', 'admin', 'office-chair-up', 'Cadeira Admin 02', 'Assento da baia 02.', 7, 18, 1, 1, false, false),
  obj('adm-d3', 'admin', 'desk-admin', 'Baia Administrativo 03', 'Estação de arquivo e relatórios.', 3, 21, 2, 1, true, true),
  obj('adm-c3', 'admin', 'office-chair-up', 'Cadeira Admin 03', 'Assento da baia 03.', 3, 22, 1, 1, false, false),
  obj('adm-printer', 'admin', 'printer-8bit', 'Impressora 8-Bits', 'Multifuncional matricial para documentos físicos.', 7, 21, 1, 1, true, true),
  obj('adm-file', 'admin', 'filing-cabinet', 'Arquivo Administrativo', 'Gaveteiro de pastas classificadas.', 9, 21, 1, 1, true, false),

  // 5. ILHA BACKEND
  obj('be-d1', 'backend', 'desk-backend', 'Baia Backend 01', 'Estação com monitores duplos de terminal e código.', 13, 17, 2, 1, true, true),
  obj('be-c1', 'backend', 'office-chair-up', 'Cadeira Backend 01', 'Assento da baia 01.', 13, 18, 1, 1, false, false),
  obj('be-d2', 'backend', 'desk-backend', 'Baia Backend 02', 'Estação com monitores duplos para APIs e bancos.', 17, 17, 2, 1, true, true),
  obj('be-c2', 'backend', 'office-chair-up', 'Cadeira Backend 02', 'Assento da baia 02.', 17, 18, 1, 1, false, false),
  obj('be-d3', 'backend', 'desk-backend', 'Baia Backend 03', 'Estação com terminal de logs e microserviços.', 13, 21, 2, 1, true, true),
  obj('be-c3', 'backend', 'office-chair-up', 'Cadeira Backend 03', 'Assento da baia 03.', 13, 22, 1, 1, false, false),
  obj('be-rack1', 'backend', 'mini-rack', 'Mini-Rack de Testes', 'Switch local e ambiente de staging do Backend.', 18, 21, 1, 1, true, true),
  obj('be-rack2', 'backend', 'mini-rack', 'Mini-Rack Auxiliar', 'Unidade de build e cache local.', 19, 21, 1, 1, true, false),

  // 6. ILHA FRONTEND
  obj('fe-d1', 'frontend', 'desk-frontend', 'Baia Frontend 01', 'Estação com telas de interface e componentes React.', 23, 17, 2, 1, true, true),
  obj('fe-c1', 'frontend', 'office-chair-up', 'Cadeira Frontend 01', 'Assento da baia 01.', 23, 18, 1, 1, false, false),
  obj('fe-d2', 'frontend', 'desk-frontend', 'Baia Frontend 02', 'Estação de UI Design e tokens visuais.', 27, 17, 2, 1, true, true),
  obj('fe-c2', 'frontend', 'office-chair-up', 'Cadeira Frontend 02', 'Assento da baia 02.', 27, 18, 1, 1, false, false),
  obj('fe-d3', 'frontend', 'desk-frontend', 'Baia Frontend 03', 'Estação de Canvas, animações e responsividade.', 23, 21, 2, 1, true, true),
  obj('fe-c3', 'frontend', 'office-chair-up', 'Cadeira Frontend 03', 'Assento da baia 03.', 23, 22, 1, 1, false, false),
  obj('fe-board', 'frontend', 'wireframe-board', 'Quadro de Wireframes', 'Painel com rascunhos de telas e fluxos de usuário.', 27, 21, 3, 1, true, true),

  // 7. ILHA MARKETING
  obj('mkt-d1', 'marketing', 'desk-marketing', 'Baia Marketing 01', 'Estação de criação de copy e campanhas.', 33, 17, 2, 1, true, true),
  obj('mkt-c1', 'marketing', 'office-chair-up', 'Cadeira Marketing 01', 'Assento da baia 01.', 33, 18, 1, 1, false, false),
  obj('mkt-d2', 'marketing', 'desk-marketing', 'Baia Marketing 02', 'Estação de métricas de funil e SEO.', 37, 17, 2, 1, true, true),
  obj('mkt-c2', 'marketing', 'office-chair-up', 'Cadeira Marketing 02', 'Assento da baia 02.', 37, 18, 1, 1, false, false),
  obj('mkt-d3', 'marketing', 'desk-marketing', 'Baia Marketing 03', 'Estação de conteúdo e lançamentos.', 33, 21, 2, 1, true, true),
  obj('mkt-c3', 'marketing', 'office-chair-up', 'Cadeira Marketing 03', 'Assento da baia 03.', 33, 22, 1, 1, false, false),
  obj('mkt-board', 'marketing', 'campaign-board', 'Mural de Campanhas e Ideias', 'Quadro de cortiça com post-its e cronograma de lançamentos.', 37, 21, 3, 1, true, true),

  // 8. LABORATÓRIO DE QA / HOMOLOGAÇÃO
  obj('qa-bench-1', 'qa-lab', 'qa-bench', 'Bancada Técnica de QA', 'Monitores de teste automatizado e inspeção de build.', 44, 17, 4, 1, true, true),
  obj('qa-c1', 'qa-lab', 'office-chair-up', 'Cadeira QA 01', 'Assento da bancada norte.', 45, 18, 1, 1, false, false),
  obj('qa-c2', 'qa-lab', 'office-chair-up', 'Cadeira QA 02', 'Assento da bancada norte.', 47, 18, 1, 1, false, false),
  obj('qa-mag', 'qa-lab', 'qa-magnifier', 'Estação Lupa / Auditoria', 'Bancada de inspeção detalhada de bugs.', 49, 17, 1, 1, true, true),
  obj('qa-bench-2', 'qa-lab', 'qa-bench', 'Bancada de Homologação', 'Terminal de validação final antes da entrega.', 45, 21, 4, 1, true, true),
  obj('qa-c3', 'qa-lab', 'office-chair-up', 'Cadeira QA 03', 'Assento da bancada sul.', 46, 22, 1, 1, false, false),
  obj('qa-siren', 'qa-lab', 'qa-siren', 'Sirene de Alerta QA', 'Sirene visual na parede (desligada por padrão). Clique para testar.', 51, 16, 1, 1, true, true, 'qa-siren'),

  // 9. RECEPÇÃO / ONBOARDING
  obj('rec-counter', 'recepcao', 'reception-counter', 'Balcão de Recepção', 'Atendimento inicial e onboarding de visitantes e agentes.', 3, 31, 4, 1, true, true),
  obj('rec-chair', 'recepcao', 'office-chair-down', 'Cadeira da Recepção', 'Posto de atendimento.', 4, 30, 1, 1, false, false),
  obj('rec-sofa', 'recepcao', 'sofa-v', 'Sofá de Espera', 'Área confortável para aguardar onboarding.', 9, 32, 1, 3, true, false),
  obj('rec-table', 'recepcao', 'coffee-table', 'Mesinha de Centro', 'Apoio com revistas técnicas.', 8, 33, 1, 1, true, false),
  obj('rec-p1', 'recepcao', 'plant-tall', 'Vaso de Planta', 'Planta decorativa da entrada.', 2, 29, 1, 1, true, false),
  obj('rec-p2', 'recepcao', 'plant-tall', 'Vaso de Planta', 'Planta decorativa da entrada.', 10, 29, 1, 1, true, false),
  obj('rec-p3', 'recepcao', 'plant-small', 'Vaso da Entrada', 'Planta junto à porta principal.', 2, 35, 1, 1, true, false),
  obj('rec-p4', 'recepcao', 'plant-small', 'Vaso da Entrada', 'Planta junto à porta principal.', 10, 35, 1, 1, true, false),

  // 10. CPD / SALA DE SERVIDORES
  obj('cpd-ac', 'cpd', 'ac-unit', 'Ar-Condicionado Industrial', 'Climatização dedicada mantendo os racks em baixa temperatura.', 14, 29, 2, 1, true, false),
  obj('cpd-r1', 'cpd', 'server-rack', 'Rack de Servidores 01', 'Cluster de processamento com LEDs de status.', 14, 31, 1, 1, true, true, 'env-vault'),
  obj('cpd-r2', 'cpd', 'server-rack', 'Rack de Servidores 02', 'Cluster de memória vetorial.', 15, 31, 1, 1, true, true, 'env-vault'),
  obj('cpd-r3', 'cpd', 'server-rack', 'Rack de Servidores 03', 'Gateway de APIs externas.', 19, 31, 1, 1, true, true, 'env-vault'),
  obj('cpd-r4', 'cpd', 'server-rack', 'Rack de Servidores 04', 'Balanceador de carga e logs.', 20, 31, 1, 1, true, true, 'env-vault'),
  obj('cpd-r5', 'cpd', 'server-rack', 'Rack de Servidores 05', 'Nó redundante de inferência.', 14, 34, 1, 1, true, true, 'env-vault'),
  obj('cpd-r6', 'cpd', 'server-rack', 'Rack de Servidores 06', 'Armazenamento frio.', 15, 34, 1, 1, true, true, 'env-vault'),
  obj('cpd-r7', 'cpd', 'server-rack', 'Rack de Servidores 07', 'Monitoramento e firewall.', 19, 34, 1, 1, true, true, 'env-vault'),
  obj('cpd-r8', 'cpd', 'server-rack', 'Rack de Servidores 08', 'Backup de checkpoints.', 20, 34, 1, 1, true, true, 'env-vault'),
  obj('cpd-vault', 'cpd', 'vault-terminal', 'Terminal do Cofre .env', 'Gerenciador seguro de variáveis e chaves de API.', 17, 35, 1, 1, true, true, 'env-vault'),

  // 11. REFEITÓRIO / COPA / CAFETERIA
  obj('ref-fridge', 'refeitorio', 'fridge', 'Geladeira Inox', 'Bebidas e lanches da equipe.', 24, 29, 1, 1, true, false),
  obj('ref-espresso', 'refeitorio', 'espresso-counter', 'Balcão + Máquina de Café Expresso', 'Prepara café expresso fresco para recarregar o ânimo.', 25, 29, 2, 1, true, true, 'espresso'),
  obj('ref-micro', 'refeitorio', 'microwave-counter', 'Balcão + Micro-ondas', 'Bancada de preparo rápido.', 27, 29, 2, 1, true, false),
  obj('ref-t1', 'refeitorio', 'cafe-table', 'Mesa da Copa 01', 'Mesa pequena para refeições e café.', 25, 33, 1, 1, true, false),
  obj('ref-s1', 'refeitorio', 'stool', 'Banqueta', 'Assento da mesa 01.', 24, 33, 1, 1, false, false),
  obj('ref-s2', 'refeitorio', 'stool', 'Banqueta', 'Assento da mesa 01.', 26, 33, 1, 1, false, false),
  obj('ref-t2', 'refeitorio', 'cafe-table', 'Mesa da Copa 02', 'Mesa pequena para refeições e café.', 30, 33, 1, 1, true, false),
  obj('ref-s3', 'refeitorio', 'stool', 'Banqueta', 'Assento da mesa 02.', 29, 33, 1, 1, false, false),
  obj('ref-s4', 'refeitorio', 'stool', 'Banqueta', 'Assento da mesa 02.', 31, 33, 1, 1, false, false),

  // 12. SALA DE RECREAÇÃO
  obj('rec-arcade', 'recreacao', 'arcade-cabinet', 'Máquina de Fliperama 8-Bits', 'Arcade clássico com jogo pixelado rodando em demonstração.', 36, 29, 1, 1, true, true, 'arcade'),
  obj('rec-pingpong', 'recreacao', 'pingpong-table', 'Mesa de Ping-Pong', 'Mesa oficial com rede e raquetes para partidas rápidas.', 39, 31, 3, 2, true, true),
  obj('rec-sofa', 'recreacao', 'sofa-h', 'Sofá Lounge', 'Sofá macio para descanso e leitura.', 36, 35, 3, 1, true, false),
  obj('rec-pufe-1', 'recreacao', 'beanbag-cyan', 'Pufe Ciano', 'Pufe ergonômico da área gamer.', 36, 32, 1, 1, false, false),
  obj('rec-pufe-2', 'recreacao', 'beanbag-amber', 'Pufe Âmbar', 'Pufe confortável próximo ao sofá.', 41, 35, 1, 1, false, false),

  // 13. BANHEIRO / VESTIÁRIO
  obj('ban-sinks', 'banheiro', 'sink-mirror', 'Pias com Espelhos', 'Lavatórios com espelhos iluminados.', 49, 29, 3, 1, true, false),
  obj('ban-lockers', 'banheiro', 'locker', 'Fileira de Armários (Lockers)', 'Armários individuais para pertences da equipe.', 45, 31, 1, 3, true, true),
  obj('ban-stall-1', 'banheiro', 'toilet-stall', 'Cabine 01', 'Cabine sanitária fechada.', 47, 35, 1, 1, true, false),
  obj('ban-stall-2', 'banheiro', 'toilet-stall', 'Cabine 02', 'Cabine sanitária fechada.', 49, 35, 1, 1, true, false),
  obj('ban-stall-3', 'banheiro', 'toilet-stall', 'Cabine 03', 'Cabine sanitária fechada.', 51, 35, 1, 1, true, false),
];

export interface OfficeGridMap {
  cols: number;
  rows: number;
  floors: FloorStyle[][];
  walls: (WallStyle | null)[][];
  walkable: boolean[][];
  roomAtTile: (RoomId | null)[][];
  objectAtTile: (InteractiveObject | null)[][];
}

function isDoorTile(x: number, y: number): boolean {
  // Ala Norte Doors (y = 11)
  if (y === 11 && ((x >= 8 && x <= 10) || (x >= 26 && x <= 28) || (x >= 43 && x <= 45))) {
    return true;
  }
  // Ala Central Top (y = 15)
  if (y === 15) {
    if (
      (x >= 4 && x <= 8) ||
      (x >= 14 && x <= 18) ||
      (x >= 24 && x <= 28) ||
      (x >= 34 && x <= 38) ||
      (x >= 47 && x <= 48)
    ) {
      return true;
    }
  }
  // Ala Central Bottom (y = 24)
  if (y === 24) {
    if (
      (x >= 4 && x <= 8) ||
      (x >= 14 && x <= 18) ||
      (x >= 24 && x <= 28) ||
      (x >= 34 && x <= 38) ||
      (x >= 47 && x <= 48)
    ) {
      return true;
    }
  }
  // QA Lab West Door (x = 42, y = 19..20)
  if (x === 42 && (y === 19 || y === 20)) {
    return true;
  }
  // Ala Sul Doors (y = 28)
  if (
    y === 28 &&
    ((x >= 5 && x <= 7) ||
      (x >= 16 && x <= 18) ||
      (x >= 29 && x <= 31) ||
      (x >= 38 && x <= 40) ||
      (x >= 46 && x <= 47))
  ) {
    return true;
  }
  return false;
}

export function buildOfficeGridMap(): OfficeGridMap {
  const floors: FloorStyle[][] = Array.from({ length: MAP_ROWS }, () =>
    Array.from({ length: MAP_COLS }, () => 'corridor' as FloorStyle)
  );
  const walls: (WallStyle | null)[][] = Array.from({ length: MAP_ROWS }, () =>
    Array.from({ length: MAP_COLS }, () => null)
  );
  const roomAtTile: (RoomId | null)[][] = Array.from({ length: MAP_ROWS }, () =>
    Array.from({ length: MAP_COLS }, () => null)
  );
  const objectAtTile: (InteractiveObject | null)[][] = Array.from({ length: MAP_ROWS }, () =>
    Array.from({ length: MAP_COLS }, () => null)
  );

  // 1. Assign room floors & roomAtTile
  for (const room of ROOM_CONFIGS) {
    const { x, y, w, h } = room.bounds;
    for (let ry = y; ry < y + h; ry++) {
      for (let rx = x; rx < x + w; rx++) {
        floors[ry][rx] = room.floorStyle;
        roomAtTile[ry][rx] = room.id;
      }
    }
  }

  // Also paint Ala Central horizontal aisles (x=1, x=11, x=21, x=31, x=41 at y=16..23) as corridor
  // And threshold floor under doorways to match neighboring room floor
  for (let x = 1; x < MAP_COLS - 1; x++) {
    if (isDoorTile(x, 11)) {
      roomAtTile[11][x] = roomAtTile[10][x];
      floors[11][x] = floors[10][x];
    }
    if (isDoorTile(x, 28)) {
      roomAtTile[28][x] = roomAtTile[29][x];
      floors[28][x] = floors[29][x];
    }
    if (isDoorTile(x, 15) && x >= 43) {
      roomAtTile[15][x] = 'qa-lab';
      floors[15][x] = 'lab-tile';
    }
    if (isDoorTile(x, 24) && x >= 43) {
      roomAtTile[24][x] = 'qa-lab';
      floors[24][x] = 'lab-tile';
    }
  }
  for (let y = 19; y <= 20; y++) {
    roomAtTile[y][42] = 'qa-lab';
    floors[y][42] = 'lab-tile';
  }

  // 2. Outer Perimeter Walls
  for (let x = 0; x < MAP_COLS; x++) {
    walls[0][x] = 'solid';
    // Main building glass entrance at Reception (x = 5..7, y = 37)
    if (x >= 5 && x <= 7) {
      walls[MAP_ROWS - 1][x] = 'glass';
    } else {
      walls[MAP_ROWS - 1][x] = 'solid';
    }
  }
  for (let y = 0; y < MAP_ROWS; y++) {
    walls[y][0] = 'solid';
    walls[y][MAP_COLS - 1] = 'solid';
  }

  // 3. Ala Norte Walls (y = 1..11)
  for (let y = 1; y <= 11; y++) {
    walls[y][17] = 'solid'; // Diretoria | War Room
    walls[y][36] = 'glass'; // Glass wall between War Room & Coordenadores
  }
  for (let x = 1; x < MAP_COLS - 1; x++) {
    if (!isDoorTile(x, 11)) {
      walls[11][x] = x >= 36 ? 'glass' : 'solid';
    }
  }

  // 4. Ala Central Dividers & QA Lab Walls (y = 15..24)
  for (let x = 1; x <= 41; x++) {
    if (!isDoorTile(x, 15)) walls[15][x] = 'low-divider';
    if (!isDoorTile(x, 24)) walls[24][x] = 'low-divider';
  }
  for (let x = 42; x < MAP_COLS - 1; x++) {
    if (!isDoorTile(x, 15)) walls[15][x] = 'solid';
    if (!isDoorTile(x, 24)) walls[24][x] = 'solid';
  }
  for (let y = 15; y <= 24; y++) {
    if (!isDoorTile(42, y)) walls[y][42] = 'glass';
  }

  // 5. Ala Sul Walls (y = 28..36)
  for (let x = 1; x < MAP_COLS - 1; x++) {
    if (!isDoorTile(x, 28)) {
      if (x >= 13 && x <= 21) {
        walls[28][x] = 'reinforced'; // CPD armored wall
      } else if (x >= 1 && x <= 11) {
        walls[28][x] = 'glass'; // Reception glass frontage
      } else {
        walls[28][x] = 'solid';
      }
    }
  }
  for (let y = 28; y <= 36; y++) {
    walls[y][12] = 'solid'; // Reception | CPD
    walls[y][22] = 'reinforced'; // CPD | Refeitório
    walls[y][34] = 'solid'; // Refeitório | Recreação
    walls[y][44] = 'solid'; // Recreação | Banheiro
  }

  // 6. Place Furniture & Compute Walkable Grid
  const walkable: boolean[][] = Array.from({ length: MAP_ROWS }, (_, y) =>
    Array.from({ length: MAP_COLS }, (__, x) => walls[y][x] === null)
  );

  for (const item of FURNITURE_OBJECTS) {
    for (const t of item.tiles) {
      if (t.y >= 0 && t.y < MAP_ROWS && t.x >= 0 && t.x < MAP_COLS) {
        objectAtTile[t.y][t.x] = item;
        if (item.solid) {
          walkable[t.y][t.x] = false;
        }
      }
    }
  }

  return {
    cols: MAP_COLS,
    rows: MAP_ROWS,
    floors,
    walls,
    walkable,
    roomAtTile,
    objectAtTile,
  };
}

export const OFFICE_GRID = buildOfficeGridMap();
