// APP-LOCAL — testes do parser resiliente da Dashboard Spec.
import { describe, expect, it } from "vitest";
import {
  especVazia,
  isBlocoInvalido,
  parseDashboardSpec,
} from "./dashboard-spec";

describe("parseDashboardSpec", () => {
  it("normaliza entradas não-objeto em spec vazia", () => {
    expect(parseDashboardSpec(null)).toEqual(especVazia());
    expect(parseDashboardSpec("x")).toEqual(especVazia());
    expect(parseDashboardSpec(42)).toEqual(especVazia());
    expect(parseDashboardSpec({})).toEqual(especVazia());
  });

  it("aceita abas válidas e descarta as malformadas", () => {
    const spec = parseDashboardSpec({
      abas: [
        { id: "ia-sensibilidade", titulo: "Sensibilidade FF", top: "dashboard" },
        { id: "sem-prefixo", titulo: "Inválida" }, // sem prefixo ia-
        { id: "ia-sem-titulo" }, // sem título
        { id: "ia-top-errado", titulo: "X", top: "nao-existe" }, // top → default
        "lixo",
      ],
    });
    expect(spec.abas).toHaveLength(2);
    expect(spec.abas[0]).toEqual({
      id: "ia-sensibilidade",
      titulo: "Sensibilidade FF",
      top: "dashboard",
      grupo: "Análises IA",
    });
    expect(spec.abas[1].top).toBe("dashboard");
  });

  it("bloco de tipo desconhecido vira BlocoInvalido (aviso), nunca crash", () => {
    const spec = parseDashboardSpec({
      blocos: [
        {
          id: "b1",
          tipo: "hologram-3d",
          local: { tipo: "slot", slot: "visao.topo" },
        },
      ],
    });
    expect(spec.blocos).toHaveLength(1);
    const b = spec.blocos[0];
    expect(isBlocoInvalido(b)).toBe(true);
    if (isBlocoInvalido(b)) {
      expect(b.motivo).toContain("hologram-3d");
    }
  });

  it("bloco apontando para aba inexistente degrada em aviso", () => {
    const spec = parseDashboardSpec({
      abas: [],
      blocos: [
        { id: "b1", tipo: "kpi", local: { tipo: "aba", abaId: "ia-removida" } },
      ],
    });
    const b = spec.blocos[0];
    expect(isBlocoInvalido(b)).toBe(true);
    if (isBlocoInvalido(b)) {
      expect(b.motivo).toContain("ia-removida");
    }
  });

  it("bloco kpi válido passa inteiro (envelope só)", () => {
    const spec = parseDashboardSpec({
      abas: [{ id: "ia-x", titulo: "X" }],
      blocos: [
        {
          id: "kpi-1",
          tipo: "kpi",
          local: { tipo: "aba", abaId: "ia-x" },
          titulo: "Corte 3ª cat",
          valor: { binding: { fonte: "computado", path: "volumes.corte3Cat" } },
          formato: "m3",
        },
      ],
    });
    expect(spec.blocos).toHaveLength(1);
    expect(isBlocoInvalido(spec.blocos[0])).toBe(false);
  });

  it("bloco sem id é descartado; local inválido degrada", () => {
    const spec = parseDashboardSpec({
      blocos: [
        { tipo: "kpi", local: { tipo: "slot", slot: "visao.topo" } }, // sem id
        { id: "b2", tipo: "kpi", local: { tipo: "slot", slot: "inexistente" } },
        { id: "b3", tipo: "kpi" }, // sem local
      ],
    });
    expect(spec.blocos).toHaveLength(2);
    expect(spec.blocos.every(isBlocoInvalido)).toBe(true);
  });

  it("overlays exigem id+grafico+dados", () => {
    const spec = parseDashboardSpec({
      overlays: [
        { id: "ff14", grafico: "bruckner", nome: "FF 1,4", dados: { inline: [[0, 0]] } },
        { id: "sem-grafico", dados: { inline: [] } },
        { id: "sem-dados", grafico: "bruckner" },
      ],
    });
    expect(spec.overlays).toHaveLength(1);
    expect(spec.overlays[0].id).toBe("ff14");
  });
});
