import { AcessoEscolar } from "../../features/escola/AcessoEscolar";
import { ConsultaEscolar } from "../../features/escola/ConsultaEscolar";

export default function Eletivas() {
  return (
    <AcessoEscolar titulo="Acessar Eletivas">
      {(acesso) => <ConsultaEscolar {...acesso} somente="eletivas" />}
    </AcessoEscolar>
  );
}
