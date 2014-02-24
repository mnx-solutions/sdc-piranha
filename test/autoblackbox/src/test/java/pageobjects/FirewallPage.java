package pageobjects;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;
import static org.junit.Assert.assertTrue;

import org.openqa.selenium.NoSuchElementException;
import com.codeborne.selenide.WebDriverRunner;
import org.openqa.selenium.By;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;
import org.openqa.selenium.JavascriptExecutor;

import java.util.Date;

public class FirewallPage {
    public static void clickAddNewButton() {
        if ($("[data-ng-hide=\"data.uuid\"]").isDisplayed()) {
            $("[data-ng-hide=\"data.uuid\"]").click();
        } else if (!FirewallPage.createRuleButton().isDisplayed()) {
            $("[data-ng-hide=\"data.uuid || !rules.length\"]").click();
        }
    }

    public static SelenideElement createRuleButton() {
        return $("[data-ng-click=\"saveRule()\"]");
    }

    public static void selectProtocol(String protocolText) {
        $("#s2id_protocolSelect a").click();
        $(byText(protocolText)).click();
    }

    public static SelenideElement getAddButton(String section) {
        return $("[data-ng-click=\"add" + section + "()\"]");
    }

    private static void selectInstance(String direction, String instanceName) {
        $("#s2id_" + direction.toLowerCase() + "InstanceSelect a").click();
        $("#select2-drop").sendKeys(instanceName);
    }

    private static void selectTarget(String direction, String targetName) {
        String fieldId = "s2id_" + direction.toLowerCase() + "Select";
        $(By.id(fieldId)).$(".select2-choice").click();
        $("#select2-drop").$(byText(targetName)).click();
    }

    public static void selectTargetValue(String direction, String targetName, String targetValue) {
        SelenideElement inputField = null;
        selectTarget(direction, targetName);
        if (direction.equals("To")) {
            switch (targetName) {
                case "Tag":
                    inputField = $("[data-ng-model=\"current.to.text\"]");
                    break;
                case "Instance":
                    selectInstance(direction, targetValue);
                    break;
                case "IP":
                case "Subnet":
                    inputField = $("input[name=\"toValue\"]");
                    break;
            }
        } else if (direction.equals("From")) {
            switch (targetName) {
                case "Tag":
                    inputField = $("[data-ng-model=\"current.from.text\"]");
                    break;
                case "IP":
                case "Subnet":
                    inputField = $("input[name=\"fromValue\"]");
                    break;
                case "Instance":
                    selectInstance(direction, targetValue);
                    break;
            }
        }
        if (targetName.equals("Subnet") || targetName.equals("IP") || targetName.equals("Tag")) {
            inputField.clear();
            inputField.sendKeys(targetValue);
        }
        getAddButton(direction).click();
    }

    public static void clickUseAllButton() {
        $("[data-ng-click=\"useAllPorts()\"]").click();
    }

    public static void removeFirstOption(String optionName) {
        if (optionName.equalsIgnoreCase("protocol")) {
            $("[data-ng-repeat=\"target in data.parsed.protocol.targets\"] .remove-icon").click();
        } else {
            $("[data-ng-repeat=\"" + optionName.toLowerCase() + " in data.parsed." + optionName.toLowerCase() + "\"] .remove-icon").click();
        }
    }

    public static void removeFirstRule() {
        JavascriptExecutor ex = (JavascriptExecutor) WebDriverRunner.getWebDriver();
        ex.executeScript("$('.group-checkable').eq(1).click();");
        Common.performAction("Delete");
        Common.clickButtonInModal("Yes");
    }

    public static void editRule(String tagName) {
        ElementsCollection rows = ($$("[data-ng-repeat=\"object in objects | orderBy:order | filter:matchesFilter\"]"));
        SelenideElement row = Common.getRowByText(rows, "tag: " + tagName);
        row.$("[data-original-title=\"Edit the rule\"]").click();
    }

    public static String createTestRule() {
        Date date = new Date();
        long timestamp = date.getTime();
        String tag = "testTag" + timestamp;
        clickAddNewButton();
        clickUseAllButton();
        selectTargetValue("From", "IP", "10.10.10.10");
        selectTargetValue("To", "Tag", tag);
        createRuleButton().click();
        return tag;
    }

    public static void checkRuleParametersByTag(String tag, String action, String protocol, String from, String to) {
        ElementsCollection rows = ($$("[data-ng-repeat=\"object in objects | orderBy:order | filter:matchesFilter\"]"));
        SelenideElement row = Common.getRowByText(rows, "tag: " + tag);
        assertTrue(row.getText().contains(System.getProperty("datacenter")));
        assertTrue(row.getText().contains(action));
        assertTrue(row.getText().contains(protocol));
        assertTrue(row.getText().contains(from));
        assertTrue(row.getText().contains(to));
    }
}