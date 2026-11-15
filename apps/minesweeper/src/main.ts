import { mountApp } from './ui/app';

const root = document.querySelector('#app');
if (root === null) {
  // index.html と食い違っている。何も表示されないまま黙って終わるより、原因が分かるように止める。
  throw new Error('アプリを組み立てる要素（#app）が見つかりません');
}
mountApp(root);
