import { render } from "@testing-library/react";
import { AnsiRenderer } from "@waldiez/studio/components/AnsiRenderer";
import { describe, expect, it } from "vitest";

describe("AnsiRenderer", () => {
    it("renders plain text correctly", () => {
        const text = "This is a plain string.";
        const { container } = render(<AnsiRenderer text={text} />);
        expect(container.textContent).toBe(text);

        const spans = container.querySelectorAll("span");
        expect(spans.length).toBe(2);
        expect(spans[1].textContent).toBe(text);
        expect(spans[1].style.cssText).toBe("");
    });

    it("renders styled text correctly", () => {
        const text = "\u001b[31mRed Text\u001b[0m";
        const { container } = render(<AnsiRenderer text={text} />);

        const spans = container.querySelectorAll("span");
        expect(spans.length).toBe(2);
        expect(spans[1].textContent).toBe("Red Text");
        expect(spans[1]).toHaveStyle({ color: "var(--ansi-red)" });
    });

    it("handles mixed styled and plain text", () => {
        const text = "Normal \u001b[34mBlue\u001b[0m Normal";
        const { container } = render(<AnsiRenderer text={text} />);

        const spans = container.querySelectorAll("span");
        expect(spans.length).toBe(4);

        expect(spans[1].textContent).toBe("Normal ");
        expect(spans[1].style.cssText).toBe("");

        expect(spans[2].textContent).toBe("Blue");
        expect(spans[2]).toHaveStyle({ color: "var(--ansi-blue)" });

        expect(spans[3].textContent).toBe(" Normal");
        expect(spans[3].style.cssText).toBe("");
    });

    it("handles standalone ANSI codes without content", () => {
        const text = "\u001b[34m\u001b[0m";
        const { container } = render(<AnsiRenderer text={text} />);

        const spans = container.querySelectorAll("span");
        expect(spans.length).toBe(1);
        expect(container.textContent).toBe("");
    });

    it("renders styled asterisks correctly", () => {
        const text = "\u001b[34m***\u001b[0m";
        const { container } = render(<AnsiRenderer text={text} />);

        const spans = container.querySelectorAll("span");
        expect(spans.length).toBe(2);
        expect(spans[1].textContent).toBe("***");
        expect(spans[1]).toHaveStyle({ color: "var(--ansi-blue)" });
    });

    it("handles reset code properly", () => {
        const text = "\u001b[31mRed\u001b[0m Reset \u001b[32mGreen\u001b[0m";
        const { container } = render(<AnsiRenderer text={text} />);

        const spans = container.querySelectorAll("span");
        expect(spans.length).toBe(4);

        expect(spans[1].textContent).toBe("Red");
        expect(spans[1]).toHaveStyle({ color: "var(--ansi-red)" });

        expect(spans[2].textContent).toBe(" Reset ");
        expect(spans[2].style.cssText).toBe("");

        expect(spans[3].textContent).toBe("Green");
        expect(spans[3]).toHaveStyle({ color: "var(--ansi-green)" });
    });

    it("handles empty input gracefully", () => {
        const text = "";
        const { container } = render(<AnsiRenderer text={text} />);
        expect(container.textContent).toBe("");
        expect(container.querySelectorAll("span").length).toBe(1);
    });
});
