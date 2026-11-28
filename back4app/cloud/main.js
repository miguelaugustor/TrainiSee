/* global Parse */

const role = "EquipeEscolar";
const master = { useMasterKey: true };
const areas = ["Artes", "Ciências", "Esportes", "Humanidades", "Tecnologia", "Outra"];

function reject(message) {
  throw new Parse.Error(Parse.Error.VALIDATION_ERROR, message);
}

function text(object, key, label, max, required = true) {
  const value = object.get(key) ?? "";
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) {
    reject(`${label} deve ter ${required ? "entre 1 e " : "até "}${max} caracteres.`);
  }
  object.set(key, value.trim());
  return value.trim();
}

function samePointer(original, key, pointer) {
  return original?.get(key)?.id === pointer.id;
}

async function reference(request, key, target, label) {
  const pointer = request.object.get(key);
  if (!pointer?.id || pointer.className !== target) {
    reject(`Selecione ${label}.`);
  }
  const record = await new Parse.Query(target).get(pointer.id, master);
  if (record.get("arquivado") && !samePointer(request.original, key, pointer)) {
    reject(`O registro de ${label} foi excluído da lista.`);
  }
  return record;
}

async function unique(object, values, message) {
  const query = new Parse.Query(object.className);
  Object.entries(values).forEach(([key, value]) => query.equalTo(key, value));
  if (object.id) query.notEqualTo("objectId", object.id);
  if (await query.first(master)) reject(message);
}

const validate = {
  async Aluno({ object }) {
    text(object, "nome", "Nome", 120);
    const matricula = text(object, "matricula", "Número de matrícula", 40).toUpperCase();
    object.set("matricula", matricula);
    await unique(object, { matricula }, "Já existe um aluno com esse número de matrícula.");
  },
  async Professor({ object }) {
    text(object, "nome", "Nome", 120);
    const email = text(object, "email", "E-mail", 160, false);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) reject("Informe um e-mail válido.");
  },
  async Eletiva(request) {
    const { object } = request;
    text(object, "titulo", "Título", 120);
    if (!areas.includes(object.get("area"))) reject("Selecione a área da eletiva.");
    text(object, "descricao", "Descrição", 500, false);
    await reference(request, "professor", "Professor", "um professor");
  },
  async Aula(request) {
    const { object } = request;
    text(object, "titulo", "Título", 120);
    const data = text(object, "data", "Data", 10);
    const date = new Date(`${data}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== data) {
      reject("Informe uma data válida.");
    }
    const horario = text(object, "horario", "Horário", 5);
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(horario)) reject("Informe um horário válido.");
    const eletiva = await reference(request, "eletiva", "Eletiva", "uma eletiva");
    if (request.original && !samePointer(request.original, "eletiva", eletiva)) {
      const query = new Parse.Query("Frequencia").equalTo("aula", object);
      if (await query.first(master)) reject("Esta aula já tem frequência registrada.");
    }
  },
  async Matricula(request) {
    const { object } = request;
    const aluno = await reference(request, "aluno", "Aluno", "um aluno");
    const eletiva = await reference(request, "eletiva", "Eletiva", "uma eletiva");
    if (!["ativa", "inativa"].includes(object.get("situacao"))) reject("Selecione a situação da matrícula.");
    await unique(object, { aluno, eletiva }, "Já existe uma matrícula para este aluno e eletiva.");
  },
  async Frequencia(request) {
    const { object, original } = request;
    const aluno = await reference(request, "aluno", "Aluno", "um aluno");
    const aula = await reference(request, "aula", "Aula", "uma aula");
    if (typeof object.get("presente") !== "boolean") reject("Selecione presença ou ausência.");
    text(object, "observacao", "Observação", 500, false);
    if (!samePointer(original, "aluno", aluno) || !samePointer(original, "aula", aula)) {
      const matricula = await new Parse.Query("Matricula")
        .equalTo("aluno", aluno)
        .equalTo("eletiva", aula.get("eletiva"))
        .equalTo("situacao", "ativa")
        .first(master);
      if (!matricula) reject("O aluno precisa de matrícula ativa na eletiva da aula.");
    }
    await unique(object, { aluno, aula }, "Já existe frequência para este aluno e aula.");
  },
};

const archivedClasses = ["Aluno", "Professor", "Eletiva", "Aula"];

for (const [className, validateRecord] of Object.entries(validate)) {
  Parse.Cloud.beforeSave(className, async (request) => {
    const { object, original } = request;
    if (!request.master && (className === "Aluno" || className === "Professor") && object.dirtyKeys().includes("conta")) {
      reject("Use a opção de vincular conta no aplicativo.");
    }
    if (!request.master && original?.get("arquivado")) {
      reject("Este registro foi excluído da lista.");
    }
    if (!request.master && !original && object.get("arquivado")) {
      reject("Cadastre o registro antes de excluí-lo.");
    }
    await validateRecord(request);
    const acl = new Parse.ACL();
    acl.setRoleReadAccess(role, true);
    acl.setRoleWriteAccess(role, true);
    object.setACL(acl);
  });
}

for (const className of archivedClasses) {
  Parse.Cloud.beforeDelete(className, (request) => {
    if (!request.master) reject("Use a exclusão do aplicativo para preservar os vínculos existentes.");
  });
}

const consultasPorPerfil = {
  administrador: ["alunos", "professores", "eletivas", "aulas", "matriculas", "frequencias"],
  professor: ["eletivas", "aulas", "matriculas", "frequencias"],
  aluno: ["eletivas", "aulas", "matriculas", "frequencias"],
};
const tamanhoPagina = 25;

function negar() {
  throw new Parse.Error(119, "Seu perfil não tem acesso a esta operação.");
}

async function ehAdministrador(usuario) {
  return Boolean(await new Parse.Query(Parse.Role)
    .equalTo("name", role)
    .equalTo("users", usuario)
    .first(master));
}

async function perfilDaConta(request) {
  const usuario = request.user;
  if (!usuario) throw new Parse.Error(209, "Entre para acessar a área escolar.");
  if (await ehAdministrador(usuario)) return { perfil: "administrador" };
  const [alunos, professores] = await Promise.all(
    ["Aluno", "Professor"].map((classe) => new Parse.Query(classe)
      .equalTo("conta", usuario)
      .notEqualTo("arquivado", true)
      .limit(2)
      .find(master)),
  );
  if (alunos.length === 1 && !professores.length) return { perfil: "aluno", registro: alunos[0] };
  if (professores.length === 1 && !alunos.length) return { perfil: "professor", registro: professores[0] };
  return { perfil: "pendente" };
}

function filtrosBusca(params) {
  const busca = params.busca ?? "";
  const pagina = params.pagina ?? 0;
  if (typeof busca !== "string" || busca.length > 100) reject("Informe uma busca com até 100 caracteres.");
  if (!Number.isSafeInteger(pagina) || pagina < 0) reject("Página inválida.");
  const termo = busca.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { termo, pagina };
}

function buscarEm(classe, campos, termo) {
  if (!termo) return new Parse.Query(classe);
  const filtros = campos.map((campo) => new Parse.Query(classe).matches(campo, new RegExp(termo, "i")));
  return filtros.length === 1 ? filtros[0] : Parse.Query.or(...filtros);
}

function eletivasDoPerfil(acesso, termo) {
  const consulta = buscarEm("Eletiva", ["titulo", "area"], termo).notEqualTo("arquivado", true);
  if (acesso.perfil === "professor") consulta.equalTo("professor", acesso.registro);
  return consulta;
}

function aulasDoPerfil(acesso, termo) {
  const consulta = buscarEm("Aula", ["titulo", "data", "horario"], termo).notEqualTo("arquivado", true);
  if (acesso.perfil === "professor") consulta.matchesQuery("eletiva", eletivasDoPerfil(acesso, ""));
  if (acesso.perfil === "aluno") {
    const matriculas = new Parse.Query("Matricula")
      .equalTo("aluno", acesso.registro)
      .equalTo("situacao", "ativa")
      .matchesQuery("eletiva", eletivasDoPerfil(acesso, ""));
    consulta.matchesKeyInQuery("eletiva", "eletiva", matriculas);
  }
  return consulta;
}

function definirConsulta(tipo, acesso, termo) {
  switch (tipo) {
    case "alunos":
      return buscarEm("Aluno", ["nome", "matricula"], termo).notEqualTo("arquivado", true);
    case "professores":
      return buscarEm("Professor", ["nome", "email"], termo).notEqualTo("arquivado", true);
    case "eletivas":
      if (acesso.perfil === "aluno") {
        return new Parse.Query("Matricula")
          .equalTo("aluno", acesso.registro)
          .equalTo("situacao", "ativa")
          .matchesQuery("eletiva", eletivasDoPerfil(acesso, termo))
          .include("eletiva");
      }
      return eletivasDoPerfil(acesso, termo);
    case "aulas":
      return aulasDoPerfil(acesso, termo).include("eletiva");
    case "matriculas": {
      const porEletiva = new Parse.Query("Matricula")
        .matchesQuery("eletiva", buscarEm("Eletiva", ["titulo", "area"], termo));
      const porAluno = new Parse.Query("Matricula")
        .matchesQuery("aluno", buscarEm("Aluno", ["nome", "matricula"], termo));
      const consulta = termo ? Parse.Query.or(porAluno, porEletiva) : new Parse.Query("Matricula");
      if (acesso.perfil === "aluno") consulta.equalTo("aluno", acesso.registro);
      if (acesso.perfil === "professor") consulta.matchesQuery("eletiva", eletivasDoPerfil(acesso, ""));
      return consulta.include("aluno", "eletiva");
    }
    case "frequencias": {
      const porAula = new Parse.Query("Frequencia")
        .matchesQuery("aula", buscarEm("Aula", ["titulo", "data"], termo));
      const porAluno = new Parse.Query("Frequencia")
        .matchesQuery("aluno", buscarEm("Aluno", ["nome", "matricula"], termo));
      const consulta = termo ? Parse.Query.or(porAula, porAluno) : new Parse.Query("Frequencia");
      if (acesso.perfil === "aluno") consulta.equalTo("aluno", acesso.registro);
      if (acesso.perfil === "professor") consulta.matchesQuery("aula", aulasDoPerfil(acesso, ""));
      return consulta.include("aluno", "aula");
    }
    default:
      negar();
  }
}

function detalhes(...itens) {
  return itens.filter(Boolean).join(" · ");
}

function resultadoEscolar(objeto, perfil) {
  const id = objeto.id;
  switch (objeto.className) {
    case "Aluno":
      return { id, titulo: objeto.get("nome"), detalhes: objeto.get("matricula") };
    case "Professor":
      return { id, titulo: objeto.get("nome"), detalhes: objeto.get("email") ?? "" };
    case "Eletiva":
      return { id, titulo: objeto.get("titulo"), detalhes: detalhes(objeto.get("area"), objeto.get("descricao")) };
    case "Aula": {
      const data = objeto.get("data");
      const horario = objeto.get("horario");
      const eletiva = objeto.get("eletiva");
      return {
        id, titulo: objeto.get("titulo"), detalhes: detalhes(data, horario, eletiva?.get("titulo")),
        aula: { data, horario, eletivaId: eletiva?.id, eletivaTitulo: eletiva?.get("titulo") },
      };
    }
    case "Matricula": {
      const eletiva = objeto.get("eletiva")?.get("titulo") || "Eletiva indisponível";
      const aluno = objeto.get("aluno")?.get("nome") || "Aluno indisponível";
      const situacao = objeto.get("situacao") === "ativa" ? "Ativa" : "Inativa";
      return {
        id, titulo: perfil === "aluno" ? eletiva : aluno,
        detalhes: perfil === "aluno" ? situacao : detalhes(eletiva, situacao),
      };
    }
    case "Frequencia": {
      const aula = objeto.get("aula")?.get("titulo") || "Aula indisponível";
      const aluno = objeto.get("aluno")?.get("nome") || "Aluno indisponível";
      const registro = objeto.get("presente");
      const estado = registro === true ? "Presente" : registro === false ? "Ausente" : "Sem registro";
      return {
        id, titulo: perfil === "aluno" ? aula : aluno,
        detalhes: perfil === "aluno"
          ? detalhes(estado, objeto.get("observacao"))
          : detalhes(aula, estado, objeto.get("observacao")),
      };
    }
  }
}

Parse.Cloud.define("perfilEscolar", async (request) => {
  const acesso = await perfilDaConta(request);
  return { perfil: acesso.perfil, nome: acesso.registro?.get("nome") };
});

Parse.Cloud.define("consultarDadosEscolares", async (request) => {
  const acesso = await perfilDaConta(request);
  const { tipo } = request.params;
  if (!consultasPorPerfil[acesso.perfil]?.includes(tipo)) negar();
  const { termo, pagina } = filtrosBusca(request.params);
  const encontrados = await definirConsulta(tipo, acesso, termo)
    .ascending("objectId")
    .skip(pagina)
    .limit(tamanhoPagina + 1)
    .find(master);
  const registros = encontrados.slice(0, tamanhoPagina).flatMap((objeto) => {
    const registro = tipo === "eletivas" && acesso.perfil === "aluno" ? objeto.get("eletiva") : objeto;
    return registro ? [resultadoEscolar(registro, acesso.perfil)] : [];
  });
  return { registros, proxima: encontrados.length > tamanhoPagina ? pagina + tamanhoPagina : null };
});

function idValido(id) {
  if (typeof id !== "string" || !id.trim() || id.length > 128) reject("Selecione um registro válido.");
  return id;
}

Parse.Cloud.define("vincularContaEscolar", async (request) => {
  const acesso = await perfilDaConta(request);
  if (acesso.perfil !== "administrador") negar();
  const { tipo, registroId, email } = request.params;
  const classe = tipo === "aluno" ? "Aluno" : tipo === "professor" ? "Professor" : null;
  if (!classe) reject("Selecione um aluno ou professor.");
  const registro = await new Parse.Query(classe).get(idValido(registroId), master);
  if (email === null) {
    await registro.save({ conta: null }, master);
    return { email: null };
  }
  if (registro.get("arquivado")) reject("O cadastro está arquivado.");
  const endereco = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(endereco) || endereco.length > 160) reject("Informe um e-mail válido.");
  const usuario = await new Parse.Query(Parse.User).equalTo("email", endereco).first(master);
  if (!usuario || usuario.get("emailVerified") !== true) reject("A conta precisa existir e ter e-mail verificado.");
  if (await ehAdministrador(usuario)) reject("Esta conta já é administradora.");
  for (const alvo of ["Aluno", "Professor"]) {
    const consulta = new Parse.Query(alvo).equalTo("conta", usuario);
    if (alvo === classe) consulta.notEqualTo("objectId", registro.id);
    if (await consulta.first(master)) reject("Esta conta já está vinculada a outro cadastro.");
  }
  await registro.save({ conta: usuario }, master);
  return { email: endereco };
});

async function aulaParaFrequencia(acesso, id) {
  if (acesso.perfil !== "administrador" && acesso.perfil !== "professor") negar();
  const aula = await aulasDoPerfil(acesso, "").equalTo("objectId", idValido(id)).first(master);
  if (!aula) negar();
  return aula;
}

Parse.Cloud.define("frequenciaDaAula", async (request) => {
  const acesso = await perfilDaConta(request);
  const aula = await aulaParaFrequencia(acesso, request.params.aulaId);
  const { termo, pagina } = filtrosBusca(request.params);
  const alunosAtivos = buscarEm("Aluno", ["nome", "matricula"], termo).notEqualTo("arquivado", true);
  const turma = await new Parse.Query("Matricula")
    .equalTo("eletiva", aula.get("eletiva"))
    .equalTo("situacao", "ativa")
    .matchesQuery("aluno", alunosAtivos)
    .include("aluno")
    .ascending("objectId")
    .skip(pagina)
    .limit(tamanhoPagina + 1)
    .find(master);
  const alunos = turma.slice(0, tamanhoPagina).map((vinculo) => vinculo.get("aluno"));
  const frequencias = alunos.length ? await new Parse.Query("Frequencia")
    .equalTo("aula", aula)
    .containedIn("aluno", alunos)
    .limit(tamanhoPagina)
    .find(master) : [];
  const frequenciaPorAluno = new Map(frequencias.map((objeto) => [objeto.get("aluno").id, objeto]));
  return {
    titulo: aula.get("titulo"),
    proxima: turma.length > tamanhoPagina ? pagina + tamanhoPagina : null,
    registros: alunos.map((aluno) => {
      const frequencia = frequenciaPorAluno.get(aluno.id);
      return {
        id: aluno.id,
        nome: aluno.get("nome"),
        matricula: aluno.get("matricula"),
        presente: frequencia?.get("presente") ?? null,
        observacao: frequencia?.get("observacao") ?? "",
      };
    }),
  };
});

Parse.Cloud.define("alterarFrequenciaEscolar", async (request) => {
  const acesso = await perfilDaConta(request);
  const { aulaId, alunoId, operacao, presente, observacao } = request.params;
  const aula = await aulaParaFrequencia(acesso, aulaId);
  const aluno = Parse.Object.extend("Aluno").createWithoutData(idValido(alunoId));
  const existente = await new Parse.Query("Frequencia").equalTo("aula", aula).equalTo("aluno", aluno).first(master);
  if (operacao === "remover") {
    if (existente) await existente.destroy(master);
    return { ok: true };
  }
  if (operacao !== "salvar" || typeof presente !== "boolean" || typeof observacao !== "string" ||
      observacao.trim().length > 500) reject("Informe a presença e uma observação de até 500 caracteres.");
  const registro = existente ?? new Parse.Object("Frequencia");
  await registro.save({ aula, aluno, presente, observacao: observacao.trim() }, master);
  return { ok: true };
});
