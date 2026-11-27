import { Tabs, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "react-native-paper";
import { ListaAlunos } from "../../features/alunos/ListaAlunos";
import { AulasEscolares } from "../../features/aulas/AulasEscolares";
import { FrequenciaEscolar } from "../../features/aulas/FrequenciaEscolar";
import { AcessoEscolar, type SessaoComPerfil } from "../../features/escola/AcessoEscolar";
import { ConsultaEscolar } from "../../features/escola/ConsultaEscolar";
import { ListaMatriculas } from "../../features/matriculas/ListaMatriculas";
import { ListaProfessores } from "../../features/professores/ListaProfessores";

export default function Alunos() {
  return (
    <AcessoEscolar titulo="Entrar na área escolar">
      {(acesso) => <ConteudoEscolar {...acesso} />}
    </AcessoEscolar>
  );
}

function ConteudoEscolar(acesso: SessaoComPerfil) {
  const router = useRouter();
  const { secao, aluno, aula } = useLocalSearchParams<{ secao?: string; aluno?: string; aula?: string }>();
  const administrador = acesso.perfil.perfil === "administrador";
  const equipe = administrador || acesso.perfil.perfil === "professor";
  const alunoId = secao === "matriculas" && typeof aluno === "string" ? aluno : undefined;
  const voltarParaAlunos = () => router.setParams({ secao: "alunos", aluno: "", aula: "" });
  const abrirAulas = () => router.setParams({ secao: "aulas", aula: "" });

  if (equipe && secao === "frequencia" && typeof aula === "string" && aula) {
    return <>
      <Tabs.Screen options={{ headerTitle: "Frequência" }} />
      <FrequenciaEscolar key={aula} {...acesso} aulaId={aula} aoVoltar={abrirAulas} />
    </>;
  }
  if (equipe && secao === "aulas") {
    return <>
      <Tabs.Screen options={{ headerTitle: "Aulas" }} />
      <AulasEscolares {...acesso} aoVoltar={voltarParaAlunos}
        aoAbrirFrequencia={(id) => router.setParams({ secao: "frequencia", aula: id })} />
    </>;
  }

  if (!administrador || secao === "consulta") {
    return (
      <>
        <Tabs.Screen options={{ headerTitle: "Área escolar" }} />
        <ConsultaEscolar
          {...acesso}
          antes={equipe ? <>
            {administrador ? <Button onPress={voltarParaAlunos}>Voltar para Alunos</Button> : null}
            <Button mode="outlined" icon="calendar-check" onPress={abrirAulas}>Aulas e frequência</Button>
          </> : undefined}
        />
      </>
    );
  }

  const titulo = secao === "professores" ? "Professores" : alunoId ? "Matrículas" : "Alunos";
  return (
    <>
      <Tabs.Screen options={{ headerTitle: titulo }} />
      {secao === "professores" ? (
        <ListaProfessores sessao={acesso.sessao} aoExpirar={acesso.expirar} aoVoltar={voltarParaAlunos} />
      ) : alunoId ? (
        <ListaMatriculas key={alunoId} sessao={acesso.sessao} alunoId={alunoId}
          aoExpirar={acesso.expirar} aoVoltar={voltarParaAlunos} />
      ) : (
        <ListaAlunos
          sessao={acesso.sessao}
          aoSair={acesso.encerrar}
          aoExpirar={acesso.expirar}
          aoAbrirMatriculas={(id) => router.setParams({ secao: "matriculas", aluno: id })}
          atalhos={<>
            <Button icon="magnify" mode="outlined" onPress={() => router.setParams({ secao: "consulta" })}>Consultar dados</Button>
            <Button icon="calendar-check" mode="outlined" onPress={abrirAulas}>Aulas e frequência</Button>
          </>}
        />
      )}
    </>
  );
}
