(function() {
  const canvas = document.getElementById('nn-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let animationId;
  let frameCount = 0;

  // --- データ定義 ---
  const inputLabelsPC = [
    "Keio University",
    "Faculty of Sci. & Tech.",
    "Elec. & Info. Eng.",
    "KCS",
    "Gifu"
  ];

  const inputLabelsMobile = [
    "Keio",     
    "Sci&Tech", 
    "EIE",      
    "KCS",
    "Gifu"
  ];

  const outputLabels = [
    "tatsubow",
    "RPG8"
  ];

  const middleLayerCounts = [6, 10, 6]; 

  const layers = [];
  const signals = [];

  const colors = {
    link: 'rgba(79, 70, 229, 0.15)', 
    nodeBase: 'rgba(30, 41, 59, 0.9)',
    nodeInput: '#3b82f6', // 青
    nodeOutput: '#d946ef', // ピンク
    textBase: 'rgba(148, 163, 184, 0.3)',
  };

  // --- クラス定義 ---
  class Node {
    constructor(x, y, label = null, type = 'middle') {
      this.x = x;
      this.y = y;
      this.label = label;
      this.type = type; 
      this.activation = 0;
      this.nextNodes = []; 
      this.hasActivated = false;
      this.typingStartFrame = -1; 
    }

    draw() {
      // 1. ノード本体（枠線）
      ctx.beginPath();
      ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = colors.nodeBase;
      
      // 出力だけピンクの枠線
      if (this.type === 'output') {
        ctx.strokeStyle = colors.nodeOutput;
      } else if (this.type === 'input') {
        ctx.strokeStyle = colors.nodeInput;
      } else {
        ctx.strokeStyle = 'rgba(79, 70, 229, 0.3)';
      }
      
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();

      // ▼▼▼ 修正: 出力ノードだけ光を維持する ▼▼▼
      if ((this.type === 'output' || this.type === 'input') && this.hasActivated) {
        // 出力ノードなら、明るさを最低 0.8 に保つ（ずっと光る）
        this.activation = Math.max(this.activation, 0.8);
      }

      // 2. 発光エフェクト
      if (this.activation > 0.01) {
        // 出力はピンク、それ以外は青
        const glowColor = (this.type === 'output') ? colors.nodeOutput : colors.nodeInput;
        
        // 出力は少し強めに光る(20)、他は普通(15)
        ctx.shadowBlur = (this.type === 'output') ? 20 : 15; 
        ctx.shadowColor = glowColor;
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        
        const size = 5 + this.activation * 2;
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        
        // ▼▼▼ 修正: 減衰処理 ▼▼▼
        if (this.type === 'output' && this.hasActivated) {
          // 出力ノードは減衰せず、フワフワと光り続ける
          this.activation = this.activation * 0.95 + 0.8 * 0.05;
        } else {
          // それ以外のノード（入力・中間）は、光ったらすぐに消える
          this.activation *= 0.92;
        }
      }

      // 3. ラベル
      if (this.label) {
        ctx.font = `${fontSize}px "Courier New", monospace`;
        
        // ラベルも出力ノードはずっと光る
        const isTextLit = (this.type === 'output' && this.hasActivated) || this.activation > 0.1;

        if (isTextLit) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${fontSize}px "Courier New", monospace`;
          ctx.shadowBlur = 10;
          ctx.shadowColor = (this.type === 'output') ? colors.nodeOutput : colors.nodeInput;
        } else {
          ctx.fillStyle = colors.textBase;
          ctx.shadowBlur = 0;
        }

        // 出力ノードのタイプライターアニメーション処理と初期非表示
        let displayedText = this.label;
        let isOutputNodeReadyToDraw = true; // 描画フラグ

        if (this.type === 'output') {
          if (this.typingStartFrame !== -1) {
            // タイピングが開始されている場合
            const progress = frameCount - this.typingStartFrame;
            const charCount = Math.min(Math.floor(progress / 2), this.label.length);
            displayedText = this.label.substring(0, charCount);
          } else {
            // タイピングが開始されていない場合（信号未到達時）は、テキストを描画しない
            isOutputNodeReadyToDraw = false;
          }
        }

        if (this.type === 'input') {
          ctx.textAlign = 'right';
          ctx.fillText(this.label, this.x - 15, this.y + 4);
        } else if (this.type === 'output' && isOutputNodeReadyToDraw) { // 描画フラグをチェック
          ctx.textAlign = 'left';
          ctx.font = `bold ${fontSize}px "Courier New", monospace`;
          ctx.fillText(displayedText, this.x + 15, this.y + 5); 
        }
      }
    }

    pulse() {
      this.activation = 1.0;
      this.hasActivated = true;
    }
  }

  class Signal {
    constructor(startNode, endNode, strength = 1.0) {
      this.startNode = startNode;
      this.endNode = endNode;
      this.strength = strength; 
      this.progress = 0;
      this.speed = 0.02 + Math.random() * 0.01; 
      this.history = [];
      this.alive = true;
    }

    update() {
      this.progress += this.speed;
      
      const currX = this.startNode.x + (this.endNode.x - this.startNode.x) * this.progress;
      const currY = this.startNode.y + (this.endNode.y - this.startNode.y) * this.progress;

      this.history.push({x: currX, y: currY});
      if (this.history.length > 8) this.history.shift();

      if (this.progress >= 1) {
        this.progress = 1;
        this.alive = false;
        this.endNode.pulse();

        // 出力ノードに信号到達時、タイピング開始フレームを設定
        if (this.endNode.type === 'output' && this.endNode.typingStartFrame === -1) {
          this.endNode.typingStartFrame = frameCount;
        }

        if (this.endNode.nextNodes.length > 0) {
          const branchCount = 1; 
          for(let i=0; i<branchCount; i++){
            const link = this.endNode.nextNodes[Math.floor(Math.random() * this.endNode.nextNodes.length)];
            
            let val = this.strength * link.weight;
            // Leaky ReLU (全滅防止)
            if (val < 0.1) val = 0.1;
            if (val > 1.0) val = 1.0;

            signals.push(new Signal(this.endNode, link.target, val));
          }
        }
      }
    }

    draw() {
      if (this.history.length < 2) return;
      
      ctx.beginPath();
      ctx.moveTo(this.history[0].x, this.history[0].y);
      for (let i = 1; i < this.history.length; i++) {
        ctx.lineTo(this.history[i].x, this.history[i].y);
      }

      const gradient = ctx.createLinearGradient(
        this.history[0].x, this.history[0].y, 
        this.history[this.history.length-1].x, this.history[this.history.length-1].y
      );
      
      gradient.addColorStop(0, 'rgba(34, 211, 238, 0)');
      gradient.addColorStop(1, `rgba(34, 211, 238, ${this.strength})`);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  let isInitialized = false;

  function init() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;

    // ※ここにあった layers.length=0 や frameCount=0 を削除しました
    if (width < 600) {
      fontSize = 10;
    } else if (width < 1200) {
      fontSize = 15;
    } else {
      fontSize = 20;
    }

    const inputLabels = (width < 600) ? inputLabelsMobile : inputLabelsPC;

    const totalLayersCount = 2 + middleLayerCounts.length;
    const paddingX = width * 0.25;
    const drawWidth = width - (paddingX * 2);
    const layerSpacing = drawWidth / (totalLayersCount - 1);

    // ■ ノードの作成（初回のみ実行）
    if (!isInitialized) {
      layers.length = 0;
      signals.length = 0;
      frameCount = 0;

      // 1. 入力層作成
      const inputLayer = [];
      inputLabels.forEach((label, i) => {
        inputLayer.push(new Node(0, 0, label, 'input')); // 座標は後でセット
      });
      layers.push(inputLayer);

      // 2. 中間層作成
      middleLayerCounts.forEach((count) => {
        const middleLayer = [];
        for (let j = 0; j < count; j++) {
          middleLayer.push(new Node(0, 0, null, 'middle'));
        }
        layers.push(middleLayer);
      });

      // 3. 出力層作成
      const outputLayer = [];
      outputLabels.forEach((label, i) => {
        outputLayer.push(new Node(0, 0, label, 'output'));
      });
      layers.push(outputLayer);

      // 4. 接続（初回のみ）
      for (let i = 0; i < layers.length - 1; i++) {
        const current = layers[i];
        const next = layers[i+1];
        current.forEach(node => {
          next.forEach(target => {
            if (node.type === 'input' || Math.random() > 0.3) {
              const weight = (Math.random() * 2.0) - 0.5;
              node.nextNodes.push({ target: target, weight: weight });
            }
          });
          // 孤立防止
          if (node.nextNodes.length === 0) {
            const target = next[Math.floor(Math.random() * next.length)];
            node.nextNodes.push({ target: target, weight: 1.0 });
          }
        });
      }

      isInitialized = true;
    }

    // ■ 座標の更新（初回もリサイズ時も毎回実行）
    // これにより、アニメーション状態を維持したままノードだけ移動します
    
    // 1. 入力層の座標更新
    const inputSpacing = height / (inputLabels.length + 1);
    layers[0].forEach((node, i) => {
      node.x = paddingX;
      node.y = inputSpacing * (i + 1);
    });

    // 2. 中間層の座標更新
    let currentLayerIndex = 1;
    middleLayerCounts.forEach((count) => {
      const x = paddingX + layerSpacing * currentLayerIndex;
      const spacing = height / (count + 1);
      layers[currentLayerIndex].forEach((node, j) => {
        node.x = x;
        node.y = spacing * (j + 1);
      });
      currentLayerIndex++;
    });

    // 3. 出力層の座標更新
    const outputSpacing = height / (outputLabels.length + 1);
    const outputX = paddingX + layerSpacing * (totalLayersCount - 1);
    layers[layers.length - 1].forEach((node, i) => {
      node.x = outputX;
      node.y = outputSpacing * (i + 1);
    });
  }

  function handleSequence() {
    // アニメーション開始直後（frameCountが0の時）に一度だけ実行する
    if (frameCount === 0) {
      const inputLayer = layers[0]; // 入力層を取得
      
      // 入力層の全てのノードに対してループ
      inputLayer.forEach(node => {
        // ノードをアクティベートして光らせる
        node.pulse();
        
        // 次の層へ信号を送り出す
        if (node.nextNodes.length > 0) {
          node.nextNodes.forEach(link => {
            // 全ての入力ノードから信号を同時にスタート
            signals.push(new Signal(node, link.target, 1.0));
          });
        }
      });

    } else if (frameCount === 250) { // ACCESS GRANTEDの表示タイミングは適当に調整
      const statusText = document.getElementById('loading-status');
      if(statusText) {
        statusText.innerText = "ACCESS GRANTED";
        statusText.classList.remove('text-cyan-400');
        statusText.classList.add('text-purple-400');
      }
    }
  }

  function animate() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.fillStyle = 'rgba(17, 24, 39, 0.9)'; 
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = colors.link;
    ctx.lineWidth = 1;
    ctx.beginPath();
    layers.forEach(layer => {
      layer.forEach(node => {
        node.nextNodes.forEach(link => {
          const target = link.target;
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(target.x, target.y);
        });
      });
    });
    ctx.stroke();

    ctx.globalCompositeOperation = 'source-over';
    layers.forEach(layer => layer.forEach(node => node.draw()));

    ctx.globalCompositeOperation = 'source-over'; 
    ctx.shadowBlur = 0; 
    ctx.shadowColor = 'transparent'; 

    for (let i = signals.length - 1; i >= 0; i--) {
      signals[i].update();
      if(signals[i].alive) {
        signals[i].draw();
      } else {
        signals.splice(i, 1);
      }
    }

    handleSequence();
    frameCount++;
    animationId = requestAnimationFrame(animate);
  }

  window.addEventListener('resize', init);
  init();
  animate();

  window.hideNNLoader = function() {
    const loader = document.getElementById('nn-loader-overlay');
    if(loader) {
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.remove();
        cancelAnimationFrame(animationId);
      }, 700);
    }
  };
})();