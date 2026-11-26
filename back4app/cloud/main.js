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
