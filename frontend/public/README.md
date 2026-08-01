# Assets públicos

Arquivos aqui são servidos na raiz do site (`public/login-bg.jpg` → `/login-bg.jpg`).

## `login-bg.jpg` — imagem de fundo da tela de login

A tela de login (`src/pages/LoginPage.tsx`) procura por este arquivo. **Ele é
opcional**: se não existir, o navegador ignora a camada e um gradiente de marca
assume o fundo, sem erro no console e sem quebrar o layout.

Para trocar a arte, basta colocar o arquivo aqui — nenhum código muda.

### O que a foto precisa ter

| Requisito | Por quê |
|---|---|
| **1920×1080 ou maior**, JPG | O fundo é `cover` em tela cheia; menos que isso borra em monitor grande |
| **Menos de ~300 KB** (comprimir!) | É a primeira tela de quem chega pelo anúncio; peso alto derruba a conversão |
| **Área central e esquerda mais limpa** | O título fica à esquerda e o card de login à direita — rosto ou objeto no meio briga com o texto |
| **Tom mais escuro ou médio** | Há um véu escuro por cima; foto muito clara deixa o texto branco ilegível |
| **Escola brasileira de verdade** | Banco de imagem genérico (carteira e lousa americanas) passa menos confiança que o gradiente atual |

O ideal é uma foto real de uma escola cliente, com autorização de uso de imagem
— e atenção à LGPD se houver crianças identificáveis no enquadramento.
