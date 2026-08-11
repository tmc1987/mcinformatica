# MC Informática — Site Oficial

Site da MC Informática (loja de informática, assistência técnica, novos e usados),
publicado em **www.mcinformatica.net.br** via GitHub Pages.

O site não realiza venda direta: todos os anúncios e botões levam o cliente para o
WhatsApp da loja, onde a negociação é fechada.

## Painel da loja

Os produtos são cadastrados pelo painel, sem precisar mexer em código:

**www.mcinformatica.net.br/admin.html**

No painel dá para incluir, editar, reordenar e excluir produtos, definir preço e
descrição e enviar a foto direto do celular ou do computador. Cada alteração é
publicada no site em cerca de 1 minuto.

O acesso é feito com uma chave do GitHub (*fine-grained personal access token*) com
permissão **Contents: Read and write** apenas neste repositório. A chave fica salva
somente no navegador de quem usa o painel — o próprio painel explica como criá-la.

## Estrutura

| Arquivo | O que é |
|---------|---------|
| `index.html` | Página da loja (textos, contatos e horários) |
| `style.css` | Aparência do site |
| `app.js` | Monta a vitrine a partir do `produtos.json` e os links de WhatsApp |
| `produtos.json` | Lista de produtos — gravada pelo painel |
| `admin.html` | Painel da loja (página independente) |
| `img/logo.jpg` | Arte oficial da marca (cabeçalho, abertura, rodapé e favicon) |
| `img/produtos/` | Fotos enviadas pelo painel |
| `CNAME` | Domínio próprio do site |

Alterações enviadas ao branch `main` entram no ar automaticamente em poucos minutos.

## Ajustes feitos no código

- **Número do WhatsApp**: constante `NUMERO_WHATSAPP`, no topo do `app.js` e do `admin.html`.
- **Textos, contatos e horários**: `index.html`.
- **Categorias disponíveis**: mapa `CATEGORIAS` no `app.js` e a lista de opções no `admin.html`.
