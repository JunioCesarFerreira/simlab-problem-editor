# simlab-problem-editor

Editor visual para autoria de instâncias de problemas WSN compatíveis com o pipeline de simulação [SimLab](https://github.com/JunioCesarFerreira/simlab).

🇺🇸 [Read in English](README.md)

## Visão Geral

**simlab-problem-editor** é um editor de canvas baseado em navegador, desenvolvido com **Vue 3 + TypeScript + Pinia**, que permite projetar visualmente instâncias de problemas de Redes de Sensores Sem Fio (WSN) e exportá-las como JSON no formato exato consumido pelo motor de otimização e simulação do SimLab.

Em vez de escrever JSON manualmente, você carrega uma imagem de referência da área de implantação, desenha a fronteira da região, posiciona o sink e os nós candidatos, traça trajetórias dos nós móveis e exporta — a ferramenta gera automaticamente as expressões paramétricas dos segmentos de rota.

## Funcionalidades

- **Imagem de fundo** — carregue qualquer imagem como referência espacial; calibre seus limites para coordenadas do mundo
- **Calibração de escala** — arraste um segmento de comprimento conhecido sobre a imagem para reescalar todas as coordenadas do mundo de forma consistente
- **Definição da região** — configure o bounding box do problema `[xmin, ymin, xmax, ymax]`
- **Posicionamento do sink** — posicione exatamente um nó sink no canvas
- **Posicionamento de candidatos** — adicione, mova e remova posições candidatas de sensores
- **Trajetórias de nós móveis** — desenhe rotas multi-segmento usando:
  - Polilinha (linear por partes)
  - Elipse (gera expressões paramétricas trigonométricas)
- **Grafo de conectividade** — ative/desative (`G` / botão ⬡) para visualizar arestas entre nós dentro de `radiusOfReach`
- **Ferramenta de medição** — régua para medir distâncias em coordenadas do mundo
- **Exportação JSON** — gera um arquivo `{ "problem": { ... } }` válido e pronto para o SimLab
- **Prévia do JSON** — painel em tempo real com o problema atual formatado em JSON

## Atalhos de Teclado

| Tecla | Ação |
|-------|------|
| `S` | Ferramenta de seleção |
| `K` | Posicionar sink |
| `C` | Posicionar candidato |
| `L` | Desenhar linha (segmento de polilinha) |
| `E` | Desenhar elipse |
| `M` | Medir |
| `R` | Calibração de escala |
| `G` | Alternar grafo de conectividade |
| `Del` | Remover elemento selecionado |
| `Esc` | Cancelar desenho atual |
| Scroll | Zoom |
| Arrastar com botão do meio | Pan |

## Formato de Saída

O editor exporta JSON no schema de problema do SimLab:

```json
{
  "problem": {
    "name": "exemplo",
    "radius_of_reach": 100,
    "radius_of_inter": 200,
    "region": [-150, -150, 150, 150],
    "sink": [0, 0],
    "candidates": [[x1, y1], [x2, y2]],
    "mobile_nodes": [
      {
        "name": "node1",
        "source_code": "node.c",
        "speed": 5,
        "time_step": 1,
        "is_closed": true,
        "is_round_trip": false,
        "path_segments": [
          ["cx + rx * np.cos(2 * np.pi * t)", "cy + ry * np.sin(2 * np.pi * t)"]
        ]
      }
    ]
  }
}
```

As expressões paramétricas usam `t ∈ [0, 1]` por segmento e referenciam `np.cos`, `np.sin` e `np.pi` — compatíveis com os solvers do SimLab baseados em NumPy.

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Framework | Vue 3 (Composition API) |
| Linguagem | TypeScript |
| Estado | Pinia |
| Renderização | HTML5 Canvas 2D |
| Build | Vite |

## Como Executar

```bash
npm install
npm run dev
```

Build para produção:

```bash
npm run build
```

## Estrutura do Projeto

```
src/
  components/
    editor/
      ProblemEditor.vue   # layout raiz do editor
      CanvasView.vue      # canvas, ferramentas e lógica de desenho
      Toolbar.vue         # botões de ferramentas e toggles
      PropertiesPanel.vue # propriedades do elemento selecionado
      JsonPreviewPanel.vue
  stores/
    problemStore.ts       # dados do problema e lógica de exportação
    editorStore.ts        # estado da UI (ferramenta ativa, viewport, overlays)
  models/
    problem.ts            # tipos do domínio
  services/
    exportProblemJson.ts  # rascunho → JSON do SimLab
```

## Repositórios Relacionados

- [SimLab](https://github.com/JunioCesarFerreira/simlab) — motor de simulação e otimização
- [wsn-design-space-exploration](https://github.com/JunioCesarFerreira/wsn-design-space-exploration) — framework comparativo MILP / multiobjetivo
- [Cooja-MO-SimLab](https://github.com/JunioCesarFerreira/Cooja-MO-SimLab) — protótipo inicial do SimLab baseado em Cooja

## Licença

MIT
