import { describe, expect, it } from "vitest";
import type { MtpPacote } from "./mtp";
import {
  botaForasDe,
  comparativoSecoesDe,
  cronogramaDe,
  jazidasDe,
  otimizacoesDe,
  simultaneidadeDe,
  tempoCaminhoDe,
} from "./pacote-ext";

/** Pacote mínimo (só o que os helpers de extensão inspecionam). */
function pacote(extra: Record<string, unknown>): MtpPacote {
  return { recursos: { jazidas: [], botaForas: [] }, ...extra } as unknown as MtpPacote;
}

describe("pacote-ext — helpers de narrowing", () => {
  it("retorna null quando o bloco está ausente", () => {
    const p = pacote({});
    expect(cronogramaDe(p)).toBeNull();
    expect(tempoCaminhoDe(p)).toBeNull();
    expect(otimizacoesDe(p)).toBeNull();
    expect(simultaneidadeDe(p)).toBeNull();
    expect(jazidasDe(p)).toEqual([]);
    expect(botaForasDe(p)).toEqual([]);
  });

  it("retorna null quando o bloco existe mas está vazio", () => {
    expect(cronogramaDe(pacote({ cronograma: { versao: 1, tarefas: [] } }))).toBeNull();
    expect(tempoCaminhoDe(pacote({ tempo_caminho: { versao: 1, series: [] } }))).toBeNull();
    expect(
      otimizacoesDe(pacote({ otimizacoes: { versao: 1, sem_geometria: [], com_geometria: [] } })),
    ).toBeNull();
  });

  it("narrows o cronograma quando há tarefas", () => {
    const c = cronogramaDe(
      pacote({
        cronograma: {
          versao: 1,
          tarefas: [{ id: "t1", nome: "Corte SP-342", inicio_dia: 0, duracao_dias: 30 }],
        },
      }),
    );
    expect(c?.tarefas).toHaveLength(1);
    expect(c?.tarefas[0].nome).toBe("Corte SP-342");
  });

  it("normaliza otimizacoes parciais e detecta conteúdo", () => {
    const o = otimizacoesDe(
      pacote({ otimizacoes: { sem_geometria: [{ id: "o1", titulo: "CFT -50%" }] } }),
    );
    expect(o?.sem_geometria).toHaveLength(1);
    expect(o?.com_geometria).toEqual([]);
    expect(o?.versao).toBe(1);
  });

  it("lê recursos.jazidas / botaForas", () => {
    const p = pacote({
      recursos: {
        jazidas: [{ id: "j1", nome: "Jazida Norte", cbr_pct: 20 }],
        botaForas: [{ id: "bf1", nome: "BF Sul" }],
      },
    });
    expect(jazidasDe(p)).toHaveLength(1);
    expect(jazidasDe(p)[0].nome).toBe("Jazida Norte");
    expect(botaForasDe(p)).toHaveLength(1);
  });

  it("lê comparativo_secoes e preserva as flags de qualidade", () => {
    expect(comparativoSecoesDe(pacote({}))).toBeNull();
    expect(
      comparativoSecoesDe(pacote({ comparativo_secoes: { versao: 1, eixos: [] } })),
    ).toBeNull();

    const c = comparativoSecoesDe(
      pacote({
        comparativo_secoes: {
          versao: 1,
          fonte: "Wolney.xml",
          surf_volumes: [{ nome: "VOLUME-2", corte: 1456939, aterro: 328088 }],
          eixos: [
            {
              eixo_id: "GEO_CONTORNO_NORTE_A",
              n: 118,
              n_trunc: 20,
              n_extrap: 1,
              estacas_extrap: ["112+7.582"],
              frac_aterro_trunc: 0.66,
              v_ref: { corte: 152714, aterro: 700585 },
              v_ref_bruto: { corte: 419760, aterro: 700585 },
              v_dash: { corte: 133504, aterro: 665680 },
              linhas: [
                {
                  sta: 2247.582,
                  est: "112+7.582",
                  c_ref: 70248.3,
                  f_ref: 0,
                  extrap: true,
                  trunc: false,
                },
              ],
            },
          ],
        },
      }),
    );
    expect(c?.eixos).toHaveLength(1);
    expect(c?.eixos[0].estacas_extrap).toEqual(["112+7.582"]);
    expect(c?.eixos[0].linhas[0].extrap).toBe(true);
    // o bruto guarda o estrago da extrapolação (267 mil m³ de corte fantasma)
    expect(
      (c?.eixos[0].v_ref_bruto?.corte ?? 0) - (c?.eixos[0].v_ref.corte ?? 0),
    ).toBeGreaterThan(260000);
    expect(c?.surf_volumes?.[0].corte).toBe(1456939);
  });
});
