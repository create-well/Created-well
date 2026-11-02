# Synthetic offline-only test. No real app providers or HTTP calls.
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/local/bin/chromium', headless=True, args=['--no-sandbox'])
    blocked = []
    for width in (320, 390, 1280):
        page = browser.new_page(viewport={'width': width, 'height': 900})
        def route(r):
            if r.request.url.startswith('file:'): r.continue_()
            else: blocked.append(r.request.url); r.abort()
        page.route('**/*', route)
        page.goto('file:///data/cw-relation-mounted-fixture/index.html')
        page.get_by_text('Content is unavailable. The source could not be read.').wait_for()
        assert page.locator('#sync-state').inner_text() == 'stale'
        page.get_by_text('Data may be stale or incomplete.').wait_for()
        assert page.locator('#content-state').inner_text() == 'failed'
        assert page.locator('details').evaluate('(e)=>e.open')
        page.evaluate('window.__payload=window.__good')
        page.get_by_role('button',name='Retry',exact=True).click()
        page.wait_for_function('window.__calls === 2')
        page.wait_for_function("document.querySelector('#sync-state').textContent === 'fresh'")
        summary=page.locator('summary')
        if not page.locator('details').evaluate('(e)=>e.open'):
            summary.focus(); page.keyboard.press('Enter')
        assert page.get_by_role('link').count() == 2
        assert page.locator('#forum-count').inner_text() == '2'
        page.get_by_role('button',name='Fixture optimistic edit').click()
        page.wait_for_function("document.querySelector('#forum-values').textContent === 'optimistic edit|optimistic edit'")
        assert page.get_by_text('Alpha',exact=True).count() == 1 and page.get_by_text('Beta',exact=True).count() == 1
        page.get_by_role('button',name='Fixture optimistic delete').click()
        page.wait_for_function("document.querySelector('#forum-count').textContent === '0'")
        assert page.get_by_role('link').count() == 2
        # Reload then fail: source failure keeps last-good forum, visibly stale.
        page.evaluate('window.__payload=window.__good')
        page.get_by_role('button',name='Fixture retry').click()
        page.wait_for_function("document.querySelector('#forum-count').textContent === '2'")
        page.evaluate('window.__payload=window.__bad')
        page.get_by_role('button',name='Fixture retry').click()
        page.wait_for_function("document.querySelector('#content-state').textContent === 'failed'")
        assert page.locator('#forum-count').inner_text() == '2'
        assert page.locator('#sync-state').inner_text() == 'stale'
        page.get_by_text('Content is unavailable. The source could not be read.').wait_for()
        # Unknown query completeness is partial, not an empty or fresh source.
        page.evaluate('window.__payload=window.__partial')
        page.get_by_role('button',name='Fixture retry').click()
        page.wait_for_function('window.__calls === 5')
        if not page.locator('details').evaluate('(e)=>e.open'): page.locator('summary').click()
        page.get_by_text('Content or its Flow relations may be incomplete.').wait_for()
        assert page.locator('#sync-state').inner_text() == 'stale'
        # Verified empty source is distinct.
        page.evaluate('window.__payload=window.__empty')
        page.get_by_role('button',name='Fixture retry').click()
        page.get_by_text('No content records returned.').wait_for()
        assert page.locator('#sync-state').inner_text() == 'fresh'
        # Existing fallback remains available but cannot establish the source snapshot.
        page.evaluate('window.__throw=true')
        page.get_by_role('button',name='Fixture retry').click()
        page.get_by_text('Content is unavailable. The source could not be read.').wait_for()
        assert page.locator('#content-state').inner_text() == 'unknown'
        assert page.locator('#sync-state').inner_text() == 'stale'
        assert page.locator('#forum-count').inner_text() == '2'
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        print(f'{width}px: failure/last-good, retry, empty/partial, fallback, collision, no overflow PASS')
        page.close()
    browser.close()
    assert not blocked, f'external requests attempted: {len(blocked)}'
    print('External requests: none')
