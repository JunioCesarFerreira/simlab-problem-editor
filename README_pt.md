# simlab-problem-editor

Editor visual para criação de instâncias de problemas de Redes de Sensores sem Fio (WSN — *Wireless Sensor Networks*) compatíveis com o pipeline de experimentação do [SimLab](https://github.com/JunioCesarFerreira/simlab).

🇺🇸 [Read in English](README.md)

## Visão Geral

O **simlab-problem-editor** é um editor visual baseado em navegador, desenvolvido com **Vue 3**, **TypeScript** e **Pinia**, para criar instâncias de problemas de WSN no formato JSON esperado pelo **SimLab**.

A ferramenta foi projetada para simplificar a definição de cenários espaciais de rede, substituindo a escrita manual de JSON por um fluxo interativo em canvas. Em vez de editar coordenadas e expressões de trajetórias manualmente, é possível usar uma imagem de referência, definir a região do problema, posicionar o sink e os nós candidatos, desenhar trajetórias de nós móveis e exportar diretamente a instância do problema.

Isso é particularmente útil em cenários nos quais a estrutura espacial é importante, como layouts urbanos sintéticos, áreas industriais monitoradas ou experimentos de comunicação com mobilidade.

## O que o editor faz

Com o **simlab-problem-editor**, você pode:

- carregar uma imagem de fundo como referência espacial
- calibrar a escala do canvas para coordenadas do mundo real
- definir a região do problema
- posicionar o nó sink
- posicionar e editar candidatos a nós fixos
- projetar visualmente trajetórias de nós móveis
- inspecionar o alcance de comunicação por meio de uma sobreposição de conectividade
- medir distâncias diretamente na cena
- exportar a instância final como JSON compatível com o SimLab

A saída exportada foi pensada para ser consumida pelos componentes de otimização e simulação do SimLab.

## Principais Funcionalidades

- **Suporte a imagem de fundo**  
  Importe um mapa, planta, croqui ou qualquer outra imagem para servir como referência geométrica do cenário.

- **Calibração em coordenadas do mundo real**  
  Defina a escala por meio de um segmento de comprimento conhecido, de modo que todas as posições sejam convertidas consistentemente para coordenadas do mundo real.

- **Definição da região**  
  Especifique a caixa delimitadora do cenário no formato `[xmin, ymin, xmax, ymax]`.

- **Posicionamento do sink**  
  Insira exatamente um nó sink na instância do problema.

- **Posicionamento de nós candidatos**  
  Adicione, mova e remova posições candidatas para nós fixos de comunicação.

- **Construção de trajetórias móveis**  
  Desenhe trajetórias para nós móveis usando:
  - **Segmentos polilineares**
  - **Trajetórias elípticas**

- **Geração automática de trajetórias paramétricas**  
  Converta trajetórias definidas visualmente em expressões paramétricas adequadas para o processamento posterior no SimLab.

- **Visualização do grafo de conectividade**  
  Exiba arestas entre nós que estejam dentro do raio de comunicação.

- **Ferramenta de medição**  
  Meça distâncias em unidades calibradas diretamente no canvas.

- **Pré-visualização JSON em tempo real**  
  Inspecione a instância gerada em tempo real durante a edição.

- **Exportação para JSON**  
  Gere um objeto válido no formato `{ "problem": { ... } }`, pronto para uso em fluxos do SimLab.

## Fluxo típico de uso

1. Carregue uma imagem de referência.
2. Calibre a escala da imagem.
3. Defina a região do cenário.
4. Posicione o nó sink.
5. Adicione as posições candidatas de nós fixos.
6. Desenhe as trajetórias dos nós móveis.
7. Inspecione conectividade e distâncias.
8. Exporte a instância JSON gerada.

Esse fluxo facilita a construção de cenários reprodutíveis de WSN sem a necessidade de derivar manualmente coordenadas e expressões de trajetória.

## Atalhos de Teclado

| Tecla | Ação |
|------|------|
| `S` | Ferramenta de seleção |
| `K` | Posicionar sink |
| `C` | Posicionar candidato |
| `L` | Desenhar linha / segmento polilinear |
| `E` | Desenhar elipse |
| `M` | Medir distância |
| `R` | Calibrar escala |
| `G` | Alternar visualização do grafo de conectividade |
| `Del` | Remover elemento selecionado |
| `Esc` | Cancelar desenho atual |
| `Scroll` | Zoom |
| `Middle-drag` | Pan |

## Formato de Saída

O editor exporta JSON seguindo o esquema de problema do SimLab:

```json
{
  "problem": {
    "name": "example",
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
          [
            "cx + rx * np.cos(2 * np.pi * t)",
            "cy + ry * np.sin(2 * np.pi * t)"
          ]
        ]
      }
    ]
  }
}
````

### Observações sobre as expressões de trajetória

* Cada segmento de trajetória é representado de forma paramétrica com `t ∈ [0, 1]`.
* As expressões podem usar `np.cos`, `np.sin` e `np.pi`.
* O formato gerado é compatível com o processamento baseado em NumPy utilizado no SimLab.

## Tecnologias Utilizadas

| Camada                  | Tecnologia              |
| ----------------------- | ----------------------- |
| Framework               | Vue 3 (Composition API) |
| Linguagem               | TypeScript              |
| Gerenciamento de Estado | Pinia                   |
| Renderização            | HTML5 Canvas 2D         |
| Build Tool              | Vite                    |

## Primeiros Passos

### Instalação das dependências

```bash
npm install
```

### Execução em modo de desenvolvimento

```bash
npm run dev
```

### Build para produção

```bash
npm run build
```

## Estrutura do Projeto

```text
src/
  components/
    editor/
      ProblemEditor.vue      # Layout principal do editor
      CanvasView.vue         # Renderização do canvas e lógica de interação
      Toolbar.vue            # Botões de ferramentas e ações do editor
      PropertiesPanel.vue    # Propriedades editáveis do elemento selecionado
      JsonPreviewPanel.vue   # Visualização JSON em tempo real
  stores/
    problemStore.ts          # Estado do modelo do problema e lógica de exportação
    editorStore.ts           # Estado da interface, ferramenta ativa, viewport e overlays
  models/
    problem.ts               # Tipos e interfaces de domínio
  services/
    exportProblemJson.ts     # Conversão do estado do editor para JSON do SimLab
```

## Casos de Uso

Este editor é útil para:

* prototipagem rápida de cenários de WSN
* experimentos de projeto de rede com mobilidade
* preparação de instâncias de benchmark para pipelines de otimização
* geração de entradas de problema para avaliação baseada em simulação
* definição visual de cenários estruturados a partir de mapas ou imagens de layout

## Repositórios Relacionados

* [SimLab](https://github.com/JunioCesarFerreira/simlab) — pipeline de experimentação, simulação e otimização
* [wsn-design-space-exploration](https://github.com/JunioCesarFerreira/wsn-design-space-exploration) — framework para exploração do espaço de projeto com MILP e otimização multiobjetivo
* [Cooja-MO-SimLab](https://github.com/JunioCesarFerreira/Cooja-MO-SimLab) — protótipo inicial do SimLab baseado em Cooja

## Licença

Este projeto está licenciado sob a **MIT License**.
