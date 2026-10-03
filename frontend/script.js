const toolbox = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Números e Texto',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_print' }
      ]
    },
    {
      kind: 'category',
      name: 'Variáveis',
      contents: [
        { kind: 'block', type: 'variables_set' },
        { kind: 'block', type: 'variables_get' }
      ]
    },
    {
      kind: 'category',
      name: 'Comparação',
      contents: [
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_boolean' }
      ]
    },
    {
      kind: 'category',
      name: 'Condicional',
      contents: [
        { kind: 'block', type: 'controls_if' }
      ]
    },
    {
      kind: 'category',
      name: 'Repetição',
      contents: [
        { kind: 'block', type: 'controls_for' }
      ]
    }
  ]
};

function initWorkspace() {
  if (workspace) return;

  workspace = Blockly.inject('blockly-edit', {
    toolbox,
    move: { scrollbars: true, drag: true, wheel: true }
  });
}

function initAuthorWorkspace() {
  if (authorWorkspace) return;

  authorWorkspace = Blockly.inject('blockly-author', {
    toolbox,
    move: { scrollbars: true, drag: true, wheel: true }
  });
}

let workspace = null;
let authorWorkspace = null;
let currentQuestionId = null;
const questionStates = {};

const $ = (id) => document.getElementById(id);
const homeView = $('home-view');
const questionView = $('question-view');
const createQuestionView = $('create-question-view');
const statisticsView = $('statistics-view');
const listaQuestoes = $('lista-questoes');
const listaEstatisticas = $('lista-estatisticas');
const nomeEstatisticas = $('nome-estatisticas');
const tituloQuestao = $('titulo-questao');
const enunciadoQuestao = $('enunciado-questao');
const voltarHomeBtn = $('voltar-home-btn');
const executarBtn = $('executar-btn');
const estatisticasBtn = $('estatisticas-btn');
const novaQuestaoBtn = $('nova-questao-btn');
const arquivoQuestoes = $('arquivo-questoes');
const importacaoStatus = $('importacao-status');
const formNovaQuestao = $('form-nova-questao');
const cancelarNovaQuestaoBtn = $('cancelar-nova-questao-btn');

const apiUrl = 'https://conecta-blocos-giborelli.onrender.com';
let questions = [];

function normalizeQuestionId(title) {
  return title.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, '');
}

function scrollToPageStart() {
  window.scrollTo(0, 0);
}

function getApiErrorMessage(detail, fallback) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || JSON.stringify(item)).join('\n');
  }
  return fallback;
}

function renderQuestionList() {
  listaQuestoes.replaceChildren();
  if (questions.length === 0) {
    listaQuestoes.textContent = 'Nenhuma questão cadastrada.';
    return;
  }

  questions.forEach((question) => {
    const card = document.createElement('article');
    card.className = 'questao-card';
    card.dataset.questionId = question.id_questao;

    const heading = document.createElement('h3');
    heading.textContent = question.titulo;
    const statement = document.createElement('p');
    statement.textContent = question.enunciado;
    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.textContent = 'Abrir questão';

    card.append(heading, statement, openButton);
    listaQuestoes.append(card);
  });
}

async function carregarQuestoes() {
  listaQuestoes.textContent = 'Carregando questões...';
  try {
    const response = await fetch(`${apiUrl}/questoes`);
    if (!response.ok) throw new Error('Não foi possível carregar as questões.');
    questions = await response.json();
    renderQuestionList();
  } catch (error) {
    listaQuestoes.textContent = 'Não foi possível carregar as questões.';
    console.error('Erro ao carregar as questões:', error);
  }
}

function saveCurrentQuestionState() {
  if (!currentQuestionId || !workspace) return;

  questionStates[currentQuestionId] = Blockly.serialization.workspaces.save(workspace);
}

function loadQuestionState(questionId) {
  if (!workspace) return;

  const savedState = questionStates[questionId];
  workspace.clear();

  if (savedState) {
    Blockly.serialization.workspaces.load(savedState, workspace);
  }
}

function showHome() {
  homeView.classList.remove('hidden');
  questionView.classList.add('hidden');
  createQuestionView.classList.add('hidden');
  statisticsView.classList.add('hidden');
  voltarHomeBtn.classList.add('hidden');
  scrollToPageStart();
}

function showStatistics() {
  const nome = $('nome-usuario').value.trim();

  if (!nome) {
    alert('Digite seu nome antes de consultar as estatísticas.');
    return;
  }

  saveCurrentQuestionState();
  homeView.classList.add('hidden');
  questionView.classList.add('hidden');
  createQuestionView.classList.add('hidden');
  statisticsView.classList.remove('hidden');
  voltarHomeBtn.classList.remove('hidden');
  nomeEstatisticas.textContent = `Tentativas de ${nome}`;
  carregarEstatisticas(nome);
  scrollToPageStart();
}

async function carregarEstatisticas(nome) {
  listaEstatisticas.innerHTML = '<p>Carregando estatísticas...</p>';

  try {
    const resposta = await fetch(
      `${apiUrl}/tentativas?nome=${encodeURIComponent(nome)}`
    );

    if (!resposta.ok) throw new Error('Não foi possível consultar as tentativas.');

    const tentativas = await resposta.json();
    const questionById = Object.fromEntries(
      questions.map((question) => [question.id_questao, question])
    );

    if (tentativas.length === 0) {
      listaEstatisticas.innerHTML = '<p>Nenhuma questão tentada ainda.</p>';
      return;
    }

    listaEstatisticas.replaceChildren();
    tentativas
      .map((tentativa) => {
        const question = questionById[tentativa.id_questao];
        const item = document.createElement('div');
        item.className = 'estatistica-item';
        const title = document.createElement('span');
        title.textContent = question ? question.titulo : tentativa.id_questao;
        const count = document.createElement('strong');
        count.textContent = `${tentativa.n_tentativas} ${
          tentativa.n_tentativas === 1 ? 'tentativa' : 'tentativas'
        }`;
        item.append(title, count);
        return item;
      })
      .forEach((item) => listaEstatisticas.append(item));
  } catch (error) {
    listaEstatisticas.innerHTML = '<p>Não foi possível carregar as estatísticas.</p>';
    console.error('Erro ao consultar as estatísticas:', error);
  }
}

function showQuestion(questionId) {
  saveCurrentQuestionState();
  const question = questions.find((item) => item.id_questao === questionId);

  if (!question) return;

  currentQuestionId = question.id_questao;
  tituloQuestao.textContent = question.titulo;
  enunciadoQuestao.textContent = question.enunciado;

  homeView.classList.add('hidden');
  questionView.classList.remove('hidden');
  createQuestionView.classList.add('hidden');
  statisticsView.classList.add('hidden');
  voltarHomeBtn.classList.remove('hidden');

  document.querySelectorAll('.questao-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.questionId === question.id_questao);
  });

  initWorkspace();
  loadQuestionState(questionId);

  setTimeout(() => {
    if (workspace) {
      Blockly.svgResize(workspace);
    }
  }, 0);
  scrollToPageStart();
}

listaQuestoes.addEventListener('click', (event) => {
  const card = event.target.closest('.questao-card');
  if (!card) return;

  showQuestion(card.dataset.questionId);
});

voltarHomeBtn.addEventListener('click', () => {
  saveCurrentQuestionState();
  showHome();
});

estatisticasBtn.addEventListener('click', showStatistics);
novaQuestaoBtn.addEventListener('click', () => {
  saveCurrentQuestionState();
  homeView.classList.add('hidden');
  questionView.classList.add('hidden');
  statisticsView.classList.add('hidden');
  createQuestionView.classList.remove('hidden');
  voltarHomeBtn.classList.remove('hidden');
  formNovaQuestao.reset();
  initAuthorWorkspace();
  authorWorkspace.clear();
  setTimeout(() => Blockly.svgResize(authorWorkspace), 0);
  scrollToPageStart();
});

cancelarNovaQuestaoBtn.addEventListener('click', showHome);

arquivoQuestoes.addEventListener('change', importarQuestoesJson);
formNovaQuestao.addEventListener('submit', salvarNovaQuestao);

executarBtn.addEventListener('click', enviaFastAPI);

async function importarQuestoesJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  importacaoStatus.textContent = 'Importando questões...';
  try {
    const payload = JSON.parse(await file.text());
    const response = await fetch(`${apiUrl}/questoes/importar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(
        getApiErrorMessage(result.detail, 'Não foi possível importar o arquivo.')
      );
    }
    importacaoStatus.textContent = `${result.quantidade} questão(ões) importada(s).`;
    await carregarQuestoes();
  } catch (error) {
    importacaoStatus.textContent = `Falha na importação: ${error.message}`;
    console.error('Erro ao importar questões:', error);
  } finally {
    arquivoQuestoes.value = '';
  }
}

async function salvarNovaQuestao(event) {
  event.preventDefault();
  if (!authorWorkspace) return;

  const titulo = $('novo-titulo-questao').value.trim();
  const idQuestao = normalizeQuestionId(titulo);
  if (!idQuestao) {
    alert('Informe um título que gere um identificador válido.');
    return;
  }
  if (questions.some((question) => normalizeQuestionId(question.titulo) === idQuestao)) {
    alert('Esse título não pode ser usado, ele já existe. Insira outro título e tente novamente.');
    return;
  }

  const blocosEsperados = Blockly.serialization.workspaces.save(authorWorkspace);
  if (!blocosEsperados.blocks?.blocks?.length) {
    alert('Monte a resposta esperada no Blockly antes de salvar.');
    return;
  }

  const payload = {
    id_questao: idQuestao,
    titulo,
    enunciado: $('novo-enunciado-questao').value.trim(),
    tipo_questao: 'aberta',
    codigo_esperado: Blockly.Python.workspaceToCode(authorWorkspace),
    blocos_esperados: blocosEsperados
  };

  try {
    const response = await fetch(`${apiUrl}/questoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 409) {
        alert('Esse título não pode ser usado, ele já existe. Insira outro título e tente novamente.');
        return;
      }
      throw new Error(
        getApiErrorMessage(result.detail, 'Não foi possível salvar a questão.')
      );
    }
    formNovaQuestao.reset();
    authorWorkspace.clear();
    await carregarQuestoes();
    showHome();
    importacaoStatus.textContent = `Questão ${result.id_questao} adicionada.`;
  } catch (error) {
    alert(`Falha ao salvar a questão: ${error.message}`);
    console.error('Erro ao salvar a questão:', error);
  }
}


async function enviaFastAPI() {
  if (!workspace || !currentQuestionId) return;

  const nome = document.getElementById('nome-usuario').value.trim();
  if (!nome) {
    alert('Digite seu nome antes de executar.');
    return;
  }

  const code = Blockly.Python.workspaceToCode(workspace);
  const workspaceJson = Blockly.serialization.workspaces.save(workspace);

  try {
    const resposta = await fetch(`${apiUrl}/run-blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        id_questao: currentQuestionId,
        n_tentativas: 1,
        code,
        workspace_json: workspaceJson
      })
    });

    const resultado = await resposta.json();
    alert(resultado.message);
  } catch (e) {
    console.error('Erro ao enviar os dados ao FastAPI:', e);
  }
}

carregarQuestoes();
showHome();