package com.joyent.piranha.pageobject;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import com.joyent.piranha.Common;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;

import java.util.Date;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;
import static com.codeborne.selenide.Selenide.page;
import static org.junit.Assert.assertTrue;

public class FirewallRules extends AbstractPageObject {

    public static final String GRID_ROW_REPEATER = "[data-ng-repeat=\"object in objects | orderBy:order | filter:matchesFilter\"]";

    public FirewallRuleDetails clickAddNewButton() {
        $(byText("+ Add New Rule")).click();
        return page(FirewallRuleDetails.class);
    }

    public String createTestRule() {
        Date date = new Date();
        long timestamp = date.getTime();
        String tag = "testTag" + timestamp;
        FirewallRuleDetails firewallRuleDetails = clickAddNewButton();
        firewallRuleDetails.clickUseAllButton();
        firewallRuleDetails.selectTargetValue("From", "IP", "10.10.10.10");
        firewallRuleDetails.selectTargetValue("To", "Tag", tag);
        firewallRuleDetails.getCreateRuleButton().click();
        return tag;
    }

    public FirewallRuleDetails editRule(String tagName) {
        ElementsCollection rows = ($$(GRID_ROW_REPEATER));
        for (SelenideElement row : rows) {
            if (row.$(By.xpath("/*[contains(.,\"" + tagName + "\")]")).exists()) {
                row.$("[data-original-title=\"Edit the rule\"]").click();
                break;
            }
        }
        return page(FirewallRuleDetails.class);
    }

    public void removeFirstRule() {
        JavascriptExecutor ex = (JavascriptExecutor) WebDriverRunner.getWebDriver();
        ex.executeScript("$('.group-checkable').eq(1).click();");
        performAction("Delete");
        clickButtonInModal("Yes");
        waitForLargeSpinnerDisappear();
    }

    public void checkRuleParametersByTag(String tag, String status, String action, String protocol, String from, String to) {
        ElementsCollection rows = ($$(GRID_ROW_REPEATER));
        SelenideElement row = Common.getRowByText(rows, "tag: " + tag);
        assertTrue(row.getText().contains(status));
        assertTrue(row.getText().contains(action));
        assertTrue(row.getText().contains(protocol));
        assertTrue(row.getText().contains(from));
        assertTrue(row.getText().contains(to));
    }

    public SelenideElement getTagFromGrid(String instanceTag) {
        return $(byText("tag: " + instanceTag));
    }
}