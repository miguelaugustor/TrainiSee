const role = "EquipeEscolar";
const member = { [`role:${role}`]: true };
const permissions = {
  find: member,
  count: member,
  get: member,
  create: member,
  update: member,
  delete: member,
  addField: {},
};
const text = { type: "String" };
const flag = { type: "Boolean" };
const number = { type: "Number" };
const pointer = (targetClass) => ({ type: "Pointer", targetClass });
const conta = pointer("_User");
const camposNovos = {
  Aluno: { conta },
  Professor: { conta },
  Eletiva: { videoUrl: text, cargaHoraria: number, conteudo: text },
};

const classes = {
  Aluno: { nome: text, matricula: text, arquivado: flag, conta },
  Professor: { nome: text, email: text, arquivado: flag, conta },
  Eletiva: {
    titulo: text, area: text, descricao: text, professor: pointer("Professor"), arquivado: flag,
    ...camposNovos.Eletiva,
  },
  Aula: { titulo: text, data: text, horario: text, eletiva: pointer("Eletiva"), arquivado: flag },
  Matricula: { aluno: pointer("Aluno"), eletiva: pointer("Eletiva"), situacao: text },
  Frequencia: { aluno: pointer("Aluno"), aula: pointer("Aula"), presente: flag, observacao: text },
};

const schemas = Object.entries(classes).map(([className, fields]) => ({
  className,
  fields,
  classLevelPermissions: permissions,
}));

function schemaMatches(existing, definition) {
  return Object.entries(definition.fields).every(([name, field]) => {
    const actual = existing.fields?.[name];
    if (!actual && Object.hasOwn(camposNovos[definition.className] ?? {}, name)) return true;
    return actual?.type === field.type && actual?.targetClass === field.targetClass;
  }) && Object.entries(permissions).every(([operation, allowed]) => {
    const configured = existing.classLevelPermissions?.[operation];
    return configured &&
      Object.keys(configured).length === Object.keys(allowed).length &&
      Object.keys(allowed).every((key) => configured[key] === true);
  });
}

async function configure(request) {
  const { results: existing } = await request("/schemas");
  const byName = new Map(existing.map((schema) => [schema.className, schema]));

  for (const definition of schemas) {
    const schema = byName.get(definition.className);
    if (schema && !schemaMatches(schema, definition)) {
      throw new Error(`Revise os campos ou as permissões de ${definition.className} no painel.`);
    }
  }

  const { results: roles } = await request(`/roles?where=${encodeURIComponent(JSON.stringify({ name: role }))}`);
  if (!roles.length) {
    await request("/roles", { name: role, ACL: {} });
  } else if (!roles[0].ACL || Object.values(roles[0].ACL).some((acesso) => acesso.write === true)) {
    throw new Error("Restrinja a edição do perfil EquipeEscolar ao painel do Back4App.");
  }

  for (const schema of schemas) {
    const existente = byName.get(schema.className);
    if (!existente) {
      await request(`/schemas/${schema.className}`, schema);
      continue;
    }
    const fields = Object.fromEntries(Object.entries(camposNovos[schema.className] ?? {})
      .filter(([name]) => !existente.fields?.[name]));
    if (Object.keys(fields).length) {
      await request(`/schemas/${schema.className}`, { fields }, "PUT");
    }
  }
}

async function main() {
  const appId = process.env.BACK4APP_APPLICATION_ID;
  const masterKey = process.env.BACK4APP_MASTER_KEY;
  if (!appId || !masterKey) {
    throw new Error("Configure BACK4APP_APPLICATION_ID e BACK4APP_MASTER_KEY no processo administrativo.");
  }

  await configure(async (path, body, method = body ? "POST" : "GET") => {
    const response = await fetch(`https://parseapi.back4app.com${path}`, {
      method,
      headers: {
        "X-Parse-Application-Id": appId,
        "X-Parse-Master-Key": masterKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(`Back4App respondeu com erro ${result.code ?? response.status} em ${path.split("?")[0]}.`);
    }
    return result;
  });
  console.log("Classes e perfil EquipeEscolar conferidos. Vincule as contas autorizadas pelo painel.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { configure };
