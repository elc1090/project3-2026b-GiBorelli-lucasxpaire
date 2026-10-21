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
const cadastroBtn = $('cadastro-btn');
const loginBtn = $('login-btn');
const estatisticasBtn = $('estatisticas-btn');
const logoutBtn = $('logout-btn');
const inicioBtn = $('inicio-btn');
const welcomeView = $('welcome-view');
const homeView = $('home-view');
const registerView = $('register-view');
const loginView = $('login-view');
const questionView = $('question-view');
const createQuestionView = $('create-question-view');
const statisticsView = $('statistics-view');
const managementPanel = $('management-panel');
const perfilUsuario = $('perfil-usuario');
const tituloDashboard = $('titulo-dashboard');
const listaQuestoes = $('lista-questoes');
const listaEstatisticas = $('lista-estatisticas');
const nomeEstatisticas = $('nome-estatisticas');
const tituloQuestao = $('titulo-questao');
const enunciadoQuestao = $('enunciado-questao');
const voltarHomeBtn = $('voltar-home-btn');
const executarBtn = $('executar-btn');
const novaQuestaoBtn = $('nova-questao-btn');
const arquivoQuestoes = $('arquivo-questoes');
const importacaoStatus = $('importacao-status');
const formNovaQuestao = $('form-nova-questao');
const cancelarNovaQuestaoBtn = $('cancelar-nova-questao-btn');
const formCadastro = $('form-cadastro');
const formLogin = $('form-login');
const cadastroStatus = $('cadastro-status');
const loginStatus = $('login-status');
const enviarCadastroBtn = $('enviar-cadastro-btn');
const enviarLoginBtn = $('enviar-login-btn');

const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
const isLocalFrontend =
  localHosts.has(window.location.hostname) || window.location.protocol === 'file:';
const apiUrl = isLocalFrontend
  ? 'http://127.0.0.1:8000'
  : 'https://project3-2026b-giborelli-lucasxpaire-production.up.railway.app';
let questions = [];
let currentUser = null;

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

function getAuthHeaders() {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function checkSession() {
  const token = getToken();
  if (!token) {
    currentUser = null;
    return null;
  }
  try {
    const response = await fetch(`${apiUrl}/auth/me`, {
      headers: getAuthHeaders()
    });
    if (response.ok) {
      currentUser = await response.json();
    } else {
      currentUser = null;
      setToken(null);
    }
  } catch (error) {
    console.error('Erro ao verificar sessão:', error);
    currentUser = null;
  }
  return currentUser;
}

function updateHeader() {
  const isLoggedIn = Boolean(currentUser);
  cadastroBtn.classList.toggle('hidden', isLoggedIn);
  loginBtn.classList.toggle('hidden', isLoggedIn);
  estatisticasBtn.classList.toggle('hidden', !isLoggedIn);
  logoutBtn.classList.toggle('hidden', !isLoggedIn);
  managementPanel.classList.toggle(
    'hidden',
    !isLoggedIn || currentUser.tipo_usuario !== 'professor'
  );
  if (isLoggedIn) {
    perfilUsuario.textContent = `${currentUser.nome} · ${
      currentUser.tipo_usuario === 'professor' ? 'Professor' : 'Aluno'
    }`;
    tituloDashboard.textContent = 'Questões para responder';
  }
}

function hideViews() {
  [
    welcomeView,
    homeView,
    registerView,
    loginView,
    questionView,
    createQuestionView,
    statisticsView
  ].forEach((view) => view.classList.add('hidden'));
}

function logout() {
  setToken(null);
  currentUser = null;
  updateHeader();
  showWelcome();
}

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

function getAuthApiErrorMessage(response, detail, fallback) {
  if (response.status === 404) {
    return `A API em ${apiUrl} não possui esta rota de autenticação. Atualize o deploy do backend ou confirme a URL da API.`;
  }
  return getApiErrorMessage(detail, fallback);
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
  document.body.classList.remove('auth-screen');
  if (!currentUser) {
    showWelcome();
    return;
  }
  hideViews();
  homeView.classList.remove('hidden');
  voltarHomeBtn.classList.add('hidden');
  updateHeader();
  scrollToPageStart();
}

function showWelcome() {
  document.body.classList.remove('auth-screen');
  hideViews();
  welcomeView.classList.remove('hidden');
  voltarHomeBtn.classList.add('hidden');
  scrollToPageStart();
}

function showAuthView(view) {
  document.body.classList.add('auth-screen');
  hideViews();
  view.classList.remove('hidden');
  voltarHomeBtn.classList.add('hidden');
  scrollToPageStart();
}

function showRegister() {
  cadastroStatus.textContent = '';
  formCadastro.reset();
  showAuthView(registerView);
}

function showLogin(email = '', message = '') {
  formLogin.reset();
  $('login-email').value = email;
  loginStatus.textContent = message;
  showAuthView(loginView);
}

function showStatistics() {
  document.body.classList.remove('auth-screen');
  if (!currentUser) {
    showWelcome();
    return;
  }

  const nome = currentUser.nome;
  saveCurrentQuestionState();
  hideViews();
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
  document.body.classList.remove('auth-screen');
  if (!currentUser) return;
  saveCurrentQuestionState();
  const question = questions.find((item) => item.id_questao === questionId);

  if (!question) return;

  currentQuestionId = question.id_questao;
  tituloQuestao.textContent = question.titulo;
  enunciadoQuestao.textContent = question.enunciado;

  hideViews();
  questionView.classList.remove('hidden');
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

cadastroBtn.addEventListener('click', showRegister);
loginBtn.addEventListener('click', () => showLogin());
logoutBtn.addEventListener('click', logout);
inicioBtn.addEventListener('click', () => {
  if (currentUser) showHome();
  else showWelcome();
});
estatisticasBtn.addEventListener('click', showStatistics);
novaQuestaoBtn.addEventListener('click', () => {
  if (!currentUser || currentUser.tipo_usuario !== 'professor') return;
  document.body.classList.remove('auth-screen');
  saveCurrentQuestionState();
  hideViews();
  createQuestionView.classList.remove('hidden');
  voltarHomeBtn.classList.remove('hidden');
  formNovaQuestao.reset();
  initAuthorWorkspace();
  authorWorkspace.clear();
  setTimeout(() => Blockly.svgResize(authorWorkspace), 0);
  scrollToPageStart();
});

cancelarNovaQuestaoBtn.addEventListener('click', showHome);

document.querySelectorAll('[data-auth-view="welcome"]').forEach((button) => {
  button.addEventListener('click', showWelcome);
});
formCadastro.addEventListener('submit', cadastrarUsuario);
formLogin.addEventListener('submit', entrarUsuario);
arquivoQuestoes.addEventListener('change', importarQuestoesJson);
formNovaQuestao.addEventListener('submit', salvarNovaQuestao);

executarBtn.addEventListener('click', enviaFastAPI);

async function importarQuestoesJson(event) {
  if (!currentUser || currentUser.tipo_usuario !== 'professor') return;
  const file = event.target.files[0];
  if (!file) return;

  importacaoStatus.textContent = 'Importando questões...';
  try {
    const payload = JSON.parse(await file.text());
    const response = await fetch(`${apiUrl}/questoes/importar`, {
      method: 'POST',
      headers: getAuthHeaders(),
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
  if (!authorWorkspace || !currentUser || currentUser.tipo_usuario !== 'professor') return;

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
      headers: getAuthHeaders(),
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
  if (!workspace || !currentQuestionId || !currentUser) return;

  const nome = currentUser.nome;
  const code = Blockly.Python.workspaceToCode(workspace);
  const workspaceJson = Blockly.serialization.workspaces.save(workspace);

  try {
    const resposta = await fetch(`${apiUrl}/run-blocks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        nome,
        id_questao: currentQuestionId,
        n_tentativas: 1,
        code,
        workspace_json: workspaceJson
      })
    });

    const resultado = await resposta.json();
    if (!resposta.ok) {
      throw new Error(
        getApiErrorMessage(resultado.detail, 'Não foi possível enviar a resposta.')
      );
    }
    alert(resultado.message);
  } catch (e) {
    console.error('Erro ao enviar os dados ao FastAPI:', e);
    alert(`Falha ao enviar a resposta: ${e.message}`);
  }
}

async function cadastrarUsuario(event) {
  event.preventDefault();
  enviarCadastroBtn.disabled = true;
  cadastroStatus.textContent = 'Cadastrando...';
  const formData = new FormData(formCadastro);
  const payload = {
    nome: formData.get('nome').trim(),
    email: formData.get('email').trim(),
    senha: formData.get('senha'),
    tipo_usuario: formData.get('tipo_usuario')
  };

  try {
    const response = await fetch(`${apiUrl}/auth/cadastrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(
        getAuthApiErrorMessage(
          response,
          result.detail,
          'Não foi possível concluir o cadastro.'
        )
      );
    }
    showLogin(payload.email, 'Cadastro realizado. Entre com seu e-mail e senha.');
  } catch (error) {
    cadastroStatus.textContent = error.message;
    console.error('Erro ao cadastrar usuário:', error);
  } finally {
    enviarCadastroBtn.disabled = false;
  }
}

async function entrarUsuario(event) {
  event.preventDefault();
  enviarLoginBtn.disabled = true;
  loginStatus.textContent = 'Verificando acesso...';
  const payload = {
    email: $('login-email').value.trim(),
    senha: $('login-senha').value
  };

  try {
    const response = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(
        getAuthApiErrorMessage(
          response,
          result.detail,
          'Não foi possível entrar.'
        )
      );
    }
    setToken(result.access_token);
    currentUser = result.usuario;
    updateHeader();
    formLogin.reset();
    showHome();
    await carregarQuestoes();
  } catch (error) {
    loginStatus.textContent = error.message;
    console.error('Erro ao fazer login:', error);
  } finally {
    enviarLoginBtn.disabled = false;
  }
}

async function initializeApp() {
  await checkSession();
  updateHeader();
  if (currentUser) showHome();
  else showWelcome();
  await carregarQuestoes();
}

initializeApp();