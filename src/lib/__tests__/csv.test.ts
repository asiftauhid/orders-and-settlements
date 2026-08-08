import { describe, expect, it } from "vitest";
import { toCsv } from "../csv";

describe("toCsv", () => {
  it("joins headers and rows with commas and CRLF line endings", () => {
    const result = toCsv(
      ["Customer", "Total"],
      [["Acme Corp", "100.00"]],
    );
    expect(result).toBe("Customer,Total\r\nAcme Corp,100.00\r\n");
  });

  it("quotes a field containing a comma", () => {
    const result = toCsv(["Customer"], [["Acme, Corp"]]);
    expect(result).toBe('Customer\r\n"Acme, Corp"\r\n');
  });

  it("quotes and doubles internal quotes in a field containing a double quote", () => {
    const result = toCsv(["Note"], [['Say "hi"']]);
    expect(result).toBe('Note\r\n"Say ""hi"""\r\n');
  });

  it("quotes a field containing a newline", () => {
    const result = toCsv(["Note"], [["line1\nline2"]]);
    expect(result).toBe('Note\r\n"line1\nline2"\r\n');
  });

  it("leaves plain fields unquoted", () => {
    const result = toCsv(["Status"], [["paid"]]);
    expect(result).toBe("Status\r\npaid\r\n");
  });
});
