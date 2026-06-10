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
  // Markdown rendering: process each <p> element individually
  // Converts unprocessed markdown (headings, lists, bold, code) in paragraphs
  Even.prototype.renderMarkdown = function () {
    var self = this;
    var $content = $('.post-content');
    if (!$content.length) return;

    var $paragraphs = $content.find('p');
    if (!$paragraphs.length) return;

    var hasChanges = false;

    // Process paragraphs in order, grouping consecutive list items
    var i = 0;
    while (i < $paragraphs.length) {
      var $p = $paragraphs.eq(i);
      if ($p.parents('li, ol, ul, blockquote, pre, code').length) { i++; continue; }
      if ($p.find('pre, code, strong, em, a, img, table, blockquote, ul, ol, h1, h2, h3, h4, h5, h6').length) { i++; continue; }

      var plain = $p.text().trim();
      if (!plain) { i++; continue; }

      // --- Heading detection: lines starting with # ---
      var headingMatch = plain.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        var level = headingMatch[1].length;
        var headingText = self._processInline(headingMatch[2]);
        var headingId = self._slugify(headingText);
        $p.replaceWith('<h' + level + ' id="' + headingId + '">' + headingText + '</h' + level + '>');
        hasChanges = true;
        i++;
        continue;
      }

      // --- Inline list: "prefix - item1 - item2 - item3" ---
      var sepCount = (plain.match(/ - /g) || []).length;
      if (sepCount >= 2 && plain.split(' - ').length >= 3) {
        var items = plain.split(' - ');
        var leading = items[0].trim();
        var listItems = items.slice(1);

        // Don't handle if it looks like a numbered list (fixLists handles those)
        if (/^\d+[.、．]/.test(leading)) { i++; continue; }

        var listHtml = '';
        if (leading) {
          listHtml += '<p>' + leading + '</p>\n';
        }
        listHtml += '<ul>\n';
        for (var li = 0; li < listItems.length; li++) {
          listHtml += '<li>' + listItems[li].trim() + '</li>\n';
        }
        listHtml += '</ul>';
        $p.replaceWith(listHtml);
        i++;
        continue;
      }

      // --- Inline formatting: **bold**, `code`, *italic*, [links] ---
      var processed = self._processInline(plain);
      if (processed !== plain) {
        $p.html(processed);
      }

      i++;
    }

    // Group consecutive <p> that start with "- " into <ul> blocks
    // (handles the case where each list item is a separate <p>)
    $paragraphs = $content.find('p');
    i = 0;
    while (i < $paragraphs.length) {
      var $p2 = $paragraphs.eq(i);
      if ($p2.parents('li, ol, ul, blockquote, pre, code').length) { i++; continue; }
      var plain2 = $p2.text().trim();
      var isItem = plain2.match(/^[-*]\s+(.+)/);
      if (!isItem) { i++; continue; }

      // Found a list item — gather consecutive items
      var items2 = [isItem[1]];
      var $firstItem = $p2;
      i++;

      while (i < $paragraphs.length) {
        var $next = $paragraphs.eq(i);
        if ($next.parents('li, ol, ul, blockquote, pre, code').length) break;
        var nextText = $next.text().trim();
        var nextMatch = nextText.match(/^[-*]\s+(.+)/);
        if (!nextMatch) break;
        items2.push(nextMatch[1]);
        $next.remove();
        i++;
      }

      if (items2.length > 0) {
        var ulHtml = '<ul>\n';
        for (var li2 = 0; li2 < items2.length; li2++) {
          ulHtml += '<li>' + self._processInline(items2[li2]) + '</li>\n';
        }
        ulHtml += '</ul>';
        $firstItem.replaceWith(ulHtml);
        hasChanges = true;
      }
    }

    // If we created new headings, rebuild the TOC
    if (hasChanges && self.config.toc) {
      self._rebuildToc($content);
    }
  };

  // Generate a URL-friendly ID from heading text
  Even.prototype._slugify = function (text) {
    return text
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      || 'heading';
  };

  // Rebuild Table of Contents from all headings in post content
  Even.prototype._rebuildToc = function ($content) {
    var $toc = $('.post-toc-content');
    if (!$toc.length) return;

    var headings = [];
    $content.find('h1, h2, h3, h4, h5, h6').each(function () {
      var $h = $(this);
      var text = $h.text().trim();
      var id = $h.attr('id');
      var level = parseInt(this.tagName.charAt(1));
      if (!id) {
        id = 'heading-' + headings.length;
        $h.attr('id', id);
      }
      if (text) {
        headings.push({ text: text, id: id, level: level });
      }
    });

    if (!headings.length) return;

    // Build nested TOC HTML (respect heading hierarchy)
    var html = this._buildTocTree(headings, 1);
    $toc.html(html);
  };

  // Build nested TOC list from flat heading array
  Even.prototype._buildTocTree = function (headings, minLevel) {
    if (!headings.length) return '';
    var html = '<ol class="toc">\n';
    var i = 0;
    while (i < headings.length) {
      var h = headings[i];
      if (h.level < minLevel) { i++; continue; }
      if (h.level > minLevel) {
        // Collect child headings for deeper nesting
        var children = [];
        while (i < headings.length && headings[i].level > minLevel) {
          children.push(headings[i]);
          i++;
        }
        html += this._buildTocTree(children, minLevel + 1);
        continue;
      }
      html += '<li class="toc-item toc-level-' + h.level + '">\n';
      html += '<a class="toc-link" href="#' + h.id + '">\n';
      html += '<span class="toc-text">' + h.text + '</span>\n';
      html += '</a>\n';
      i++;
      // Check for child headings
      var childItems = [];
      while (i < headings.length && headings[i].level > h.level) {
        childItems.push(headings[i]);
        i++;
      }
      if (childItems.length > 0) {
        html += this._buildTocTree(childItems, h.level + 1);
      }
      html += '</li>\n';
    }
    html += '</ol>\n';
    return html;
  };

  // Process inline markdown: bold, italic, code, links
  Even.prototype._processInline = function (text) {
    if (!text) return '';

    // Inline code: `code`
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold: **text** or __text__
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    text = text.replace(/(?:^|[^*\w])\*([^*]+)\*(?:[^*\w]|$)/g, function(m, g1) {
      var pre = m.charAt(0) === '*' ? '' : m.charAt(0);
      var post = m.charAt(m.length - 1) === '*' ? '' : m.charAt(m.length - 1);
      return pre + '<em>' + g1 + '</em>' + post;
    });

    // Links: [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Images: ![alt](url)
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    return text;
  };

  // Fix unrendered lists: some markdown renderers don't recognize numbered lists

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
