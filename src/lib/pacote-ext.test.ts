import { describe, expect, it } from "vitest";
import type { MtpPacote } from "./mtp";
import {
  botaForasDe,
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
});
