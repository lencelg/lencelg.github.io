(function (window) {
  'use strict';

  function Even(config) {
    this.config = config;
  }

  Even.prototype.setup = function() {
    var leancloud = this.config.leancloud;

    this.navbar();
    this.responsiveTable();

    if (this.config.toc) {
      this.scrollToc();
      this.tocFollow();
    }
    if (this.config.fancybox) {
      this.fancybox();
    }
    if (leancloud.app_id && leancloud.app_key) {
      this.recordReadings();
    }
    if(this.config.latex) {
      this.renderLaTeX();
    }
    this.renderMarkdown();
    this.gfmAlerts();
    this.fixLists();
    this.copyCode();
    this.scrollProgress();
    this.backToTop();
    this.theme();
  };

  Even.prototype.navbar = function () {
    var $nav = $('#mobile-navbar');
    var $navIcon = $('.mobile-navbar-icon');

    var slideout = new Slideout({
      'panel': document.getElementById('mobile-panel'),
      'menu': document.getElementById('mobile-menu'),
      'padding': 180,
      'tolerance': 70
    });
    slideout.disableTouch();

    $navIcon.click(function () {
      slideout.toggle();
    });

    slideout.on('beforeopen', function () {
      $nav.addClass('fixed-open');
      $navIcon.addClass('icon-click').removeClass('icon-out');
    });

    slideout.on('beforeclose', function () {
      $nav.removeClass('fixed-open');
      $navIcon.addClass('icon-out').removeClass('icon-click');
    });

    $('#mobile-panel').on('touchend', function () {
      slideout.isOpen() && $navIcon.click();
    });
  };

  Even.prototype.responsiveTable = function () {
    var tables = $('.post-content > table')
    tables.wrap('<div class="table-responsive">')
  };

  Even.prototype.scrollToc = function () {
    var SPACING = 20;
    var $toc = $('.post-toc');
    var $container = $('.container');
    var $tocContent = $('.post-toc-content');
    var $footer = $('.post-footer');

    if (!$toc.length) return;

    // Detect if .container has backdrop-filter (which makes it the containing block for fixed)
    // Note: getComputedStyle may return empty string '' when not set, so check both '' and 'none'
    var containerStyle = getComputedStyle($container[0]);
    var bf = containerStyle.backdropFilter || containerStyle.webkitBackdropFilter || '';
    var hasBackdropFilter = bf !== '' && bf !== 'none';

    // Store whether we've captured the fixed left position
    var fixedLeft = null;
    var tocMarginLeft = parseFloat($toc.css('marginLeft'));
    var initialTop = $toc.offset().top - SPACING;

    // Recalculate fixedLeft on window resize to keep TOC aligned
    $(window).on('resize', function () {
      if ($toc.css('display') === 'none') return;
      if (fixedLeft === null && $(window).scrollTop() >= initialTop) {
        // In fixed mode but left not captured yet → capture now
        fixedLeft = $toc[0].getBoundingClientRect().left;
      }
      if (fixedLeft !== null) {
        // Recompute from current container position
        var cLeft = $container[0].getBoundingClientRect().left;
        fixedLeft = hasBackdropFilter ? tocMarginLeft : cLeft + tocMarginLeft;
        $toc.css({ 'left': fixedLeft });
      }
    });

    $(window).scroll(function () {
      if ($toc.css('display') === 'none') return;

      var scrollTop = $(window).scrollTop();
      var $active = $('.toc-link.active');

      // --- TOC always visible on the right side ---
      if (scrollTop < initialTop) {
        // Back to top → restore absolute positioning
        $toc.css({ 'position': 'absolute', 'top': initialTop, 'left': '', 'marginLeft': tocMarginLeft });
        fixedLeft = null; // reset so we re-capture on next switch
      } else {
        // Switching from absolute → fixed? Capture the exact rendered left position
        if (fixedLeft === null) {
          var renderLeft = $toc[0].getBoundingClientRect().left;
          if (hasBackdropFilter) {
            // backdrop-filter makes .container the containing block,
            // so left is relative to .container, not viewport
            var containerLeft = $container[0].getBoundingClientRect().left;
            fixedLeft = renderLeft - containerLeft;
          } else {
            fixedLeft = renderLeft;
          }
        }

        var footerTop = $footer.offset().top;
        var tocHeight = $toc.outerHeight();

        var tocLeft = fixedLeft;

        // TOC top: prevent overlapping footer
        var tocBottomIfFixed = SPACING + tocHeight;
        var footerTopInView = footerTop - scrollTop;

        var tocTop = SPACING;
        if (tocBottomIfFixed > footerTopInView) {
          tocTop = footerTopInView - tocHeight;
          if (tocTop < -tocHeight + 80) {
            tocTop = -tocHeight + 80;
          }
        }

        $toc.css({ 'position': 'fixed', 'top': tocTop, 'left': tocLeft, 'marginLeft': 0 });
      }

      // --- Auto-scroll TOC content to keep active link visible ---
      if ($active.length && $tocContent.length) {
        var contentEl = $tocContent[0];
        var activeEl = $active[0];
        var contentRect = contentEl.getBoundingClientRect();
        var activeRect = activeEl.getBoundingClientRect();

        if (activeRect.top < contentRect.top + 5) {
          contentEl.scrollTop -= (contentRect.top - activeRect.top + 10);
        } else if (activeRect.bottom > contentRect.bottom - 5) {
          contentEl.scrollTop += (activeRect.bottom - contentRect.bottom + 10);
        }
      }
    });
  };

  Even.prototype.tocFollow = function () {
    var HEADERFIX = 30;
    var $toclink = $('.toc-link');
    if (!$toclink.length) return;

    // Build a map of toc-link -> heading element (by id from href)
    var headings = [];
    $toclink.each(function () {
      var href = $(this).attr('href');
      if (href && href.charAt(0) === '#') {
        // Decode URL-encoded ID (e.g., %E5%9F%BA -> 基)
        var id = decodeURIComponent(href.substring(1));
        var el = document.getElementById(id);
        if (el) {
          headings.push({ el: $(el), link: $(this) });
        } else {
          headings.push(null);
        }
      } else {
        headings.push(null);
      }
    });

    // Filter out only valid heading entries
    var validHeadings = [];
    for (var i = 0; i < headings.length; i++) {
      if (headings[i]) {
        validHeadings.push(headings[i]);
      }
    }

    if (!validHeadings.length) return;

    // Smooth scroll on TOC link click
    $toclink.on('click', function (e) {
      e.preventDefault();
      var href = $(this).attr('href');
      if (href && href.charAt(0) === '#') {
        var id = decodeURIComponent(href.substring(1));
        var target = document.getElementById(id);
        if (target) {
          var top = $(target).offset().top - HEADERFIX;
          $('html, body').animate({ scrollTop: top }, 400);
        }
      }
    });

    $(window).scroll(function () {
      var scrollTop = $(window).scrollTop();
      var activeIndex = -1;

      for (var i = 0; i < validHeadings.length; i++) {
        var headingTop = validHeadings[i].el.offset().top - HEADERFIX;
        var isLast = i + 1 === validHeadings.length;
        var nextTop = isLast ? Infinity : validHeadings[i + 1].el.offset().top - HEADERFIX;

        if (scrollTop >= headingTop && scrollTop < nextTop) {
          activeIndex = i;
          break;
        }
        // If scrolled past all headings, activate the last one
        if (isLast && scrollTop >= headingTop) {
          activeIndex = i;
        }
      }

      // Apply/remove active class
      $toclink.removeClass('active');
      if (activeIndex >= 0 && validHeadings[activeIndex]) {
        validHeadings[activeIndex].link.addClass('active');
      }
    });
  };

  Even.prototype.fancybox = function () {
    if ($.fancybox) {
      $('.post').each(function () {
        $(this).find('img').each(function () {
          var href = 'href="' + this.src + '"';
          var title = 'title="' + this.alt + '"';
          $(this).wrap('<a class="fancybox" ' + href + ' ' + title + '></a>');
        });
      });

      $('.fancybox').fancybox({
        openEffect: 'elastic',
        closeEffect: 'elastic'
      });
    }
  };

  Even.prototype.recordReadings = function () {
    if (typeof AV !== 'object') return;

    var $visits = $('.post-visits');
    var Counter = AV.Object.extend('Counter');
    if ($visits.length === 1) {
      addCounter(Counter);
    } else {
      showTime(Counter);
    }

    function updateVisits(dom, time) {
      var readText = dom.text().replace(/(\d+)/i, time)
      dom.text(readText);
    }

    function addCounter(Counter) {
      var query = new AV.Query(Counter);

      var url = $visits.data('url').trim();
      var title = $visits.data('title').trim();

      query.equalTo('url', url);
      query.find().then(function (results) {
        if (results.length > 0) {
          var counter = results[0];
          counter.save(null, {
            fetchWhenSave: true
          }).then(function (counter) {
            counter.increment('time', 1);
            return counter.save();
          }).then(function (counter) {
            updateVisits($visits, counter.get('time'));
          });
        } else {
          var newcounter = new Counter();
          newcounter.set('title', title);
          newcounter.set('url', url);
          newcounter.set('time', 1);

          var acl = new AV.ACL();
          acl.setWriteAccess('*', true)
          acl.setReadAccess('*', true)
          newcounter.setACL(acl)

          newcounter.save().then(function () {
            updateVisits($visits, newcounter.get('time'));
          });
        }
      }, function (error) {
        // eslint-disable-next-line
        console.log('Error:' + error.code + ' ' + error.message);
      });
    }

    function showTime(Counter) {
      let index = 0;
      $visits.each(function () {
        var $this = $(this);
        setTimeout(
          function() {
            var query = new AV.Query(Counter);
            var url = $this.data('url').trim();
    
            query.equalTo('url', url);
            query.find().then(function (results) {
              if (results.length === 0) {
                updateVisits($this, 0);
              } else {
                var counter = results[0];
                updateVisits($this, counter.get('time'));
              }
            }, function (error) {
              // eslint-disable-next-line
              console.log('Error:' + error.code + ' ' + error.message);
            });
          }, 100*(index++));     
      })
    }
  };

  Even.prototype.theme = function () {
    var html = document.documentElement;
    var STORAGE_KEY = 'theme';
    var LIGHT_META = '#f8f5f5';
    var DARK_META = '#2b2b2b';

    function getPreferredTheme() {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function setTheme(theme) {
      html.setAttribute('data-theme', theme);
      localStorage.setItem(STORAGE_KEY, theme);
      updateMeta(theme);
    }

    function updateMeta(theme) {
      var color = theme === 'dark' ? DARK_META : LIGHT_META;
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', color);
      var ms = document.querySelector('meta[name="msapplication-navbutton-color"]');
      if (ms) ms.setAttribute('content', color);
      var apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (apple) apple.setAttribute('content', color);
    }

    // Apply saved or preferred theme
    setTheme(getPreferredTheme());

    // Listen for OS-level changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });

    // Toggle button click
    $('#theme-toggle, #theme-toggle-mobile').click(function () {
      var current = html.getAttribute('data-theme');
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  };

  // Top reading progress bar
  Even.prototype.scrollProgress = function () {
    var $bar = $('.scrollPercentage');
    if (!$bar.length) return;

    $(window).scroll(function () {
      var scrollTop = $(window).scrollTop();
      var docHeight = $(document).height() - $(window).height();
      if (docHeight > 0) {
        var progress = (scrollTop / docHeight) * 100;
        $bar.css('width', progress + '%');
      }
    });
  };

  Even.prototype.backToTop = function () {
    var $backToTop = $('#back-to-top');

    $(window).scroll(function () {
      if ($(window).scrollTop() > 100) {
        $backToTop.fadeIn(1000);
      } else {
        $backToTop.fadeOut(1000);
      }
    });

    $backToTop.click(function () {
      $('body,html').animate({ scrollTop: 0 });
    });
  };

  // LaTeX rendering (MathJax only — KaTeX auto-renders via auto-render.js)
  Even.prototype.renderLaTeX = function () {
    // Only poll for MathJax if KaTeX is NOT enabled
    if (this.config.katex && this.config.katex.enable) return;

    var loopID = setInterval(function () {
      if(window.MathJax) {
        var jax = window.MathJax;
        jax.Hub.Config({ tex2jax: { inlineMath: [['$', '$'], ['\\(', '\\)']] }});
        jax.Hub.Queue(['Typeset', jax.Hub, $(document.body)[0]]);
        clearInterval(loopID);
      }
    }, 500);
  }

  // Fix unrendered lists: some markdown renderers don't recognize numbered lists
  // without a blank line before them, outputting them as a single paragraph instead.
  // This detects such paragraphs and converts them to proper HTML lists.
  Even.prototype.fixLists = function () {
    $('.post-content p').each(function () {
      var $p = $(this);
      var html = $p.html();

      // Match numbered items: look for "N." or "N、" or "N．" patterns
      // Must have at least 2 sequential numbers in the paragraph
      var numRegex = /(\d+)\s*[.、．]/g;
      var nums = [];
      var m;
      while ((m = numRegex.exec(html)) !== null) {
        nums.push({ num: parseInt(m[1]), idx: m.index, end: numRegex.lastIndex });
      }

      if (nums.length < 2) return;

      // Check they're sequential 1,2,3...
      // Sort by position to ensure left-to-right order
      nums.sort(function(a, b) { return a.idx - b.idx; });
      for (var n = 1; n < nums.length; n++) {
        if (nums[n].num !== nums[n-1].num + 1) return;
      }

      // Split: use the match positions to break the HTML
      var items = [];
      for (var i = 0; i < nums.length; i++) {
        var startIdx = nums[i].end;
        var endIdx = i + 1 < nums.length ? nums[i + 1].idx : html.length;
        items.push(html.substring(startIdx, endIdx).trim());
      }

      if (items.length < 2) return;

      // Build HTML: leading text (if any) as <p>, then the <ol>
      var leadingText = html.substring(0, nums[0].idx).trim();
      var listHtml = '';
      if (leadingText) {
        listHtml += '<p>' + leadingText + '</p>\n';
      }
      listHtml += '<ol>\n';
      for (var j = 0; j < items.length; j++) {
        listHtml += '<li>' + items[j] + '</li>\n';
      }
      listHtml += '</ol>';

      $p.replaceWith(listHtml);
    });
  }

  // Markdown rendering for post content
  // Only runs when Hexo's renderer clearly did NOT process the content
  // (i.e., content is raw text with markdown syntax visible)
  Even.prototype.renderMarkdown = function () {
    var self = this;
    var $content = $('.post-content');
    if (!$content.length) return;

    var html = $content.html();
    if (!html) return;

    // Count significant HTML elements — if there are many, the content
    // was already rendered by Hexo's markdown engine, leave it alone.
    var tagCount = (html.match(/<\/(p|ul|ol|li|h[1-6]|blockquote|pre|code|strong|em|a|img|table)\b/gi) || []).length;
    if (tagCount >= 3) return;

    // Check the TEXT content for visible markdown syntax
    var text = $content.text();
    var hasMarkdown = false;
    hasMarkdown = hasMarkdown || /\*{2}[^*]+\*{2}/.test(text);   // **bold**
    hasMarkdown = hasMarkdown || /`[^`\n]+`/.test(text);          // `code`
    hasMarkdown = hasMarkdown || /^[-*]\s/m.test(text);           // - list
    hasMarkdown = hasMarkdown || /^\d+[.、．]\s/m.test(text);     // 1. list
    hasMarkdown = hasMarkdown || /^#{1,6}\s/m.test(text);         // # heading

    if (!hasMarkdown) return;

    // Content is raw markdown — convert it to HTML
    var processed = self._processMarkdown(text);
    if (processed && processed.length > 10) {
      $content.html(processed);
    }
  };

  // Process full markdown text to HTML
  Even.prototype._processMarkdown = function (text) {
    var self = this;
    var lines = text.split('\n');
    var result = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];
      var trimmed = line.trim();

      // Skip completely empty lines
      if (!trimmed) { i++; continue; }

      // --- Unordered list ---
      if (trimmed.match(/^[-*]\s/)) {
        var items = [];
        while (i < lines.length) {
          var m = lines[i].trim().match(/^[-*]\s+(.*)/);
          if (!m) {
            // Allow indented continuation line
            var nt = lines[i].trim();
            if (nt && !nt.match(/^[-*\d#>]/) && items.length > 0) {
              items[items.length - 1] += ' ' + self._processInlineMarkdown(nt);
              i++; continue;
            }
            break;
          }
          items.push(self._processInlineMarkdown(m[1]));
          i++;
        }
        if (items.length > 0) {
          result.push('<ul>\n<li>' + items.join('</li>\n<li>') + '</li>\n</ul>');
        }
        continue;
      }

      // --- Ordered list ---
      if (trimmed.match(/^\d+[.、．]\s/)) {
        var olItems = [];
        while (i < lines.length) {
          var om = lines[i].trim().match(/^(\d+)[.、．]\s+(.*)/);
          if (!om) {
            var nt2 = lines[i].trim();
            if (nt2 && !nt2.match(/^[-*\d#>]/) && olItems.length > 0) {
              olItems[olItems.length - 1] += ' ' + self._processInlineMarkdown(nt2);
              i++; continue;
            }
            break;
          }
          olItems.push(self._processInlineMarkdown(om[2]));
          i++;
        }
        if (olItems.length > 0) {
          result.push('<ol>\n<li>' + olItems.join('</li>\n<li>') + '</li>\n</ol>');
        }
        continue;
      }

      // --- Heading ---
      var headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
      if (headingMatch) {
        var level = headingMatch[1].length;
        result.push('<h' + level + '>' + self._processInlineMarkdown(headingMatch[2]) + '</h' + level + '>');
        i++; continue;
      }

      // --- Blockquote ---
      var bqMatch = trimmed.match(/^>\s?(.*)/);
      if (bqMatch) {
        var bqLines = [];
        while (i < lines.length) {
          var bqm = lines[i].trim().match(/^>\s?(.*)/);
          if (!bqm) break;
          bqLines.push(bqm[1]);
          i++;
        }
        var bqHtml = self._processMarkdown(bqLines.join('\n'));
        result.push('<blockquote>\n' + bqHtml + '\n</blockquote>');
        continue;
      }

      // --- Regular paragraph ---
      var paraLines = [];
      while (i < lines.length) {
        var nl = lines[i];
        var nt3 = nl.trim();
        if (!nt3) break;
        if (nt3.match(/^[-*]\s/)) break;
        if (nt3.match(/^\d+[.、．]\s/)) break;
        if (nt3.match(/^#{1,6}\s/)) break;
        if (nt3.match(/^>\s?/)) break;
        paraLines.push(nl);
        i++;
      }
      if (paraLines.length > 0) {
        result.push('<p>' + self._processInlineMarkdown(paraLines.join(' ').trim()) + '</p>');
      } else {
        i++;
      }
    }

    return result.join('\n');
  };

  // Process inline markdown: bold, italic, code, links, images
  Even.prototype._processInlineMarkdown = function (text) {
    if (!text) return '';

    // First, protect any existing HTML-like entities
    // Then apply markdown rules

    // Inline code: `code` (process first, before bold/italic)
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold: **text** or __text__
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    text = text.replace(/(\W|^)\*([^*]+)\*(\W|$)/g, '$1<em>$2</em>$3');
    text = text.replace(/(\W|^)_([^_]+)_(\W|$)/g, '$1<em>$2</em>$3');

    // Images: ![alt](url)
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // Links: [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    return text;
  };

  // Copy code button for code blocks
  Even.prototype.copyCode = function () {
    $('.highlight').each(function () {
      var $block = $(this);
      var $btn = $('<button class="copy-btn" title="Copy code">Copy</button>');
      $block.append($btn);

      $btn.on('click', function () {
        // Get code content preserving line breaks
        var $codePre = $block.find('.code pre');
        var code = '';
        if ($codePre.length) {
          // Clone to avoid modifying the DOM, replace <br> with \n
          var $clone = $codePre.clone();
          $clone.find('br').replaceWith('\n');
          code = $clone.text();
        }
        if (!code) {
          // Fallback: get from the whole block
          var $fallback = $block.find('pre').last().clone();
          $fallback.find('br').replaceWith('\n');
          code = $fallback.text();
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(function () {
            $btn.text('Copied!');
            setTimeout(function () { $btn.text('Copy'); }, 2000);
          }).catch(function () {
            fallbackCopy(code, $btn);
          });
        } else {
          fallbackCopy(code, $btn);
        }
      });
    });

    function fallbackCopy(text, $btn) {
      var $textarea = $('<textarea>');
      $textarea.val(text);
      $textarea.css({ position: 'fixed', opacity: 0, left: '-9999px' });
      $('body').append($textarea);
      $textarea.select();
      try {
        document.execCommand('copy');
        $btn.text('Copied!');
        setTimeout(function () { $btn.text('Copy'); }, 2000);
      } catch (e) {
        $btn.text('复制失败');
      }
      $textarea.remove();
    }
  }

  // GFM-style alerts: transform > [!NOTE], > [!TIP], > [!WARNING], etc.
  // Matches Markdown Preview Enhanced rendering style
  Even.prototype.gfmAlerts = function () {
    var alertTypes = {
      'note':      { title: 'Note' },
      'tip':       { title: 'Tip' },
      'important': { title: 'Important' },
      'warning':   { title: 'Warning' },
      'caution':   { title: 'Caution' }
    };

    $('.post-content blockquote').each(function () {
      var $blockquote = $(this);
      var $firstP = $blockquote.find('p').first();
      if (!$firstP.length) return;

      var text = $firstP.text().trim();
      var match = text.match(/^\[!(\w+)\]/i);
      if (!match) return;

      var type = match[1].toLowerCase();
      var alertInfo = alertTypes[type];
      if (!alertInfo) return;

      // Remove the [!NOTE] text from the first paragraph
      $firstP.html($firstP.html().replace(/^\[!\w+\]\s*/i, ''));

      // If first paragraph is now empty, remove it
      if ($firstP.text().trim() === '') {
        $firstP.remove();
      }

      // Create the alert structure
      var $title = $('<p>').addClass('markdown-alert-title').text(alertInfo.title);
      $blockquote.prepend($title);
      $blockquote.addClass('markdown-alert markdown-alert-' + type);
    });
  }

  var config = window.config;
  var even = new Even(config);
  even.setup();
}(window))
