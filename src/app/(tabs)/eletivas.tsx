import { ListaEletivas } from "../../features/eletivas/ListaEletivas";
import { AcessoEscolar } from "../../features/escola/AcessoEscolar";
import { ConsultaEscolar } from "../../features/escola/ConsultaEscolar";

export default function Eletivas() {
  return (
    <AcessoEscolar titulo="Entrar para ver as eletivas">
      {(acesso) =>
        acesso.perfil.perfil === "administrador" ? (
          <ListaEletivas
            sessao={acesso.sessao}
            podeEditar
            aoExpirar={acesso.expirar}
            botaoSair={acesso.botaoSair}
          />
        ) : (
          <ConsultaEscolar {...acesso} />
        )
      }
    </AcessoEscolar>
  );
}