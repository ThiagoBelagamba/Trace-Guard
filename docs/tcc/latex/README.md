# Monografia LaTeX (ABNT / abntex2)

PDF gerado: `main.pdf` (19 páginas, A4).

## Compilar (mesmo tectonic do currículo)

```bash
cd docs/tcc/latex
./compilar.sh
```

O script usa `~/Downloads/cv/RusselResume (1)/.bin/tectonic`. Bibliografia: **abntex2cite** + BibTeX (não use o `biber` stub dessa pasta).

Overleaf: envie a pasta `latex/`, compiler **pdfLaTeX**.

## Antes de entregar

1. Em `main.tex`, preencha instituição, curso, orientador, cidade.
2. Confira as referências na biblioteca (NBR 6023).
3. Acrescente CPU/RAM/SO no Capítulo 6.
