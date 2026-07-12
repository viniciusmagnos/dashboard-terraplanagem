import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validarPacote, geotecniaDe, type MtpPacote } from "./mtp";
import { cronogramaDe, otimizacoesDe, tempoCaminhoDe } from "./pacote-ext";

const texto = readFileSync(
  new URL("./__fixtures__/epr-br365-581-607.mtp.json", import.meta.url),
  "utf-8",
);

describe("pacote-ext — fluxo do pacote real (.mtp.json)", () => {
  it("valida o fixture e não inventa blocos opcionais", () => {
    const p = validarPacote(texto);
    expect(p.schema).toBe("manta-terraplenagem-package");
    expect(p.eixos.length).toBeGreaterThan(0);
    // fixture v1: sem geotecnia nem blocos de extensão → helpers retornam null
    expect(geotecniaDe(p)).toBeNull();
    expect(cronogramaDe(p)).toBeNull();
    expect(tempoCaminhoDe(p)).toBeNull();
    expect(otimizacoesDe(p)).toBeNull();
  });

  it("pacote ESTENDIDO: blocos extras sobrevivem à validação e populam os helpers", () => {
    const bruto = JSON.parse(texto) as Record<string, unknown>;
    bruto.cronograma = {
      versao: 1,
      tarefas: [{ id: "t1", nome: "Corte", inicio_dia: 0, duracao_dias: 30 }],
    };
    bruto.otimizacoes = {
      versao: 1,
      sem_geometria: [{ id: "o1", titulo: "CFT -50%", economia_rs: 1e6 }],
      com_geometria: [],
    };
    // validarPacote preserva chaves extras
    const p: MtpPacote = validarPacote(JSON.stringify(bruto));
    expect(cronogramaDe(p)?.tarefas).toHaveLength(1);
    expect(otimizacoesDe(p)?.sem_geometria[0].titulo).toBe("CFT -50%");
    expect(tempoCaminhoDe(p)).toBeNull(); // este não foi adicionado
  });
});
