# Usabilidade do ChaveFlow

Foram adotados os 18 princípios abaixo, com base no catálogo [Laws of UX](https://lawsofux.com/). O catálogo reúne mais princípios; esta seleção explicita quais foram usados nesta revisão. São critérios de projeto, não uma certificação de usabilidade. A confirmação com os usuários da concessionária continua sendo uma etapa de avaliação.

| Princípio | Aplicação verificável |
| --- | --- |
| 1. Efeito estética-usabilidade | A identidade azul, cartões, espaçamento e hierarquia de títulos permanecem consistentes no cadastro e na central de etiquetas. |
| 2. Lei de Jakob | Menu lateral, busca, filtros, formulário com rótulos e ações de salvar/cancelar seguem os mesmos padrões entre telas. |
| 3. Lei de Fitts | Controles novos têm alvo mínimo de 44 px; em dispositivos de toque, botões e seletores também recebem esse mínimo. |
| 4. Lei de Hick | Observações são opcionais e recolhíveis; situações automáticas do estoque saem das opções de cadastro. A aba gerencial aparece para gestor e administrador. |
| 5. Lei de Miller | Cadastro dividido em quatro grupos; geração de etiquetas orientada por três passos. |
| 6. Lei da proximidade | Cada rótulo, campo e mensagem de validação ficam juntos. Informações de cada carro acompanham sua seleção e seu QR. |
| 7. Lei da região comum | Identificação, características, foto e estoque usam regiões separadas; cada etiqueta tem seu próprio contorno. |
| 8. Lei da similaridade | Botões primários, secundários, estados de erro e confirmações seguem apresentação consistente nos fluxos alterados. |
| 9. Lei de Prägnanz | Textos de identificação e negociação usam instruções diretas, com menos termos de implementação nas telas. |
| 10. Limiar de Doherty | Busca e filtros operam localmente; carregamento, envio e geração mostram feedback imediato. Não se presume latência de rede inferior a 400 ms. |
| 11. Efeito gradiente de objetivo | O formulário mostra campos preenchidos e uma barra de progresso. |
| 12. Efeito Zeigarnik | Dados e foto selecionada permanecem no formulário em falhas; sair/recarregar a aba com alterações pendentes usa a proteção do navegador. |
| 13. Efeito Von Restorff | A ação principal recebe destaque; seleção de carros e erros ficam visualmente distinguíveis, também identificados por texto. |
| 14. Efeito de posição serial | O objetivo aparece no início; salvar/cancelar ficam no final do formulário, com ações visíveis durante a rolagem da área do formulário. |
| 15. Regra do pico-fim | Cadastro, importação e geração encerram com confirmação e próximo passo concreto. |
| 16. Lei de Postel | Busca ignora acentos e caixa; CSV aceita BOM, delimitadores, aspas escapadas e quebras dentro de campos. Validação de arquivos e permissões continua estrita. |
| 17. Lei de Tesler | O sistema normaliza orientação, tamanho e formato da foto; gera URLs de QR, preserva o destino após login e controla situações automáticas do estoque. |
| 18. Princípio de Pareto | Cadastro de carros, foto, busca, leitor e etiquetas recebem acesso direto no estoque e no menu apropriado. |

Acessibilidade complementar: foco visível, rótulos associados aos campos novos, erros anunciados, atalho para o conteúdo, foco contido no menu móvel, fechamento com Escape, notificações adaptadas à largura da tela e respeito à preferência por movimento reduzido.

## Fluxos entregues

- **Foto**: em Veículos → Cadastrar veículo ou Editar cadastro, escolha ou arraste JPG, PNG ou WEBP até 4 MB. A prévia é local; o envio ocorre ao salvar. É possível trocar, remover ou desfazer a remoção antes de salvar. A foto é decodificada e convertida para WEBP no servidor, com orientação corrigida e metadados removidos. Arquivo e cadastro são confirmados na mesma transação existente, sem migração adicional.
- **Acesso à foto**: equipe da organização, comprador autenticado com negociação vinculada ou convite individual válido para aquela negociação. Convites revogados ou expirados deixam de acessar a foto. A rota não usa o token do QR como autorização e não permite cache compartilhado.
- **Etiquetas**: gestor ou administrador abre Gerar QR Code, busca e seleciona até 40 carros, gera e confere as etiquetas, baixa o SVG individual ou imprime a folha A4. A impressão mostra apenas etiquetas, com margem branca no QR. O identificador permanece estável ao editar o carro.
- **Leitura**: a URL `/q/[token]` encaminha ao leitor. Caso o usuário precise entrar, o destino é mantido. Links antigos `cf://v/...`, código interno e chassi continuam aceitos no leitor. Contas de cliente são encaminhadas ao próprio portal.
- **CSV**: uma alteração no texto ou na unidade invalida a prévia. Repetição da confirmação é desabilitada após sucesso; o servidor revalida unidade e duplicidades durante a transação.

## Validação reproduzível

`npm test` cobre regras e serviços com dados de teste em memória. `npm run test:e2e` usa Chromium, Next.js e um transporte RPC isolado definido somente em `e2e/runtime.ts`; nenhum registro é criado no Supabase real. Execute `npx playwright install chromium` antes do primeiro teste de navegador. `npm run lint` verifica tipos e `npm run build` valida a compilação de produção.

Os testes de navegador verificam persistência da foto entre requisições, edição e remoção, decodificação do QR gerado, download, estilo de impressão, retorno após login, permissões, navegação pelos módulos, portal do comprador, foco do menu móvel, recuperação de filtros, preservação de formulário em falha de rede e ligação/encerramento do fluxo de vídeo. A câmera física, a qualidade da etiqueta impressa e serviços de e-mail precisam de validação nos dispositivos e provedores reais.
