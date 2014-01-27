package pageobjects;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;
import static org.junit.Assert.assertTrue;

import com.codeborne.selenide.WebDriverRunner;
import org.openqa.selenium.By;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;
import org.openqa.selenium.JavascriptExecutor;

import java.util.Date;

public class FirewallPage {
    public static void addNewLinkClick() {
        SelenideElement element = $(".alert.alert-joyent-blue.alert-global");
        if ($("[data-ng-hide=\"data.uuid\"]").isDisplayed()) {
            $("[data-ng-hide=\"data.uuid\"]").click();
        } else if (!FirewallPage.createRuleBtn().isDisplayed()) {
            $("[data-ng-hide=\"data.uuid || !rules.length\"]").click();
        }
    }

    public static SelenideElement createRuleBtn() {
        return $("[data-ng-click=\"saveRule()\"]");
    }

    public static void selectProtocol(String protocolText) {
        $("#s2id_protocolSelect a").click();
        $(byText(protocolText)).click();
    }

    public static SelenideElement addBtn(String section) {
        return $("[data-ng-click=\"add" + section + "()\"]");
    }

    private static void addInstance(String FromOrTo, String instanceName) {
        $("#s2id_" + FromOrTo.toLowerCase() + "InstanceSelect a").click();
        $("#select2-drop").sendKeys(instanceName);
    }

    private static void choseSource(String FromOrTo, String sourceName) {
        String fieldId = "s2id_" + FromOrTo.toLowerCase() + "Select";
        $(By.id(fieldId)).$(".select2-choice").click();
        $("#select2-drop").$(byText(sourceName)).click();
    }


    public static void selectSource(String FromOrTo, String sourceName, String sourceValue) {
        SelenideElement inputField = null;
        choseSource(FromOrTo, sourceName);
        if (FromOrTo.equals("To")) {
            switch (sourceName) {
                case "Tag":
                    inputField = $("[data-ng-model=\"current.to.text\"]");
                    break;
                case "Instance":
                    addInstance(FromOrTo, sourceValue);
                    break;
                case "IP":
                case "Subnet":
                    inputField = $("input[name=\"toValue\"]");
                    break;
            }
        } else if (FromOrTo.equals("From")) {
            switch (sourceName) {
                case "Tag":
                    inputField = $("[data-ng-model=\"current.from.text\"]");
                    break;
                case "IP":
                case "Subnet":
                    inputField = $("input[name=\"fromValue\"]");
                    break;
                case "Instance":
                    addInstance(FromOrTo, sourceValue);
                    break;
            }
        }
        if (sourceName.equals("Subnet") || sourceName.equals("IP") || sourceName.equals("Tag")) {
            inputField.clear();
            inputField.sendKeys(sourceValue);
        }
        addBtn(FromOrTo).click();
    }

    public static void useAllBtnClick() {
        $("[data-ng-click=\"useAllPorts()\"]").click();
    }

    public static void removeFirstFromOption(String option) {
        if (option.equalsIgnoreCase("protocol")) {
            $("[data-ng-repeat=\"target in data.parsed.protocol.targets\"] .remove-icon").click();
        } else {
            $("[data-ng-repeat=\"" + option.toLowerCase() + " in data.parsed." + option.toLowerCase() + "\"] .remove-icon").click();
        }
    }

    public static void removeFirstRule() {
        JavascriptExecutor ex = (JavascriptExecutor) WebDriverRunner.getWebDriver();
        ex.executeScript("$('.group-checkable').eq(1).click();");
        Common.performAction("Delete");
        Common.clickYesInModal();
    }

    public static void editFirstRuleOrByTag(String tag) {
        if (!tag.equals("")) {
            ElementsCollection rows = ($$("[data-ng-repeat=\"object in objects | orderBy:order | filter:matchesFilter\"]"));
            SelenideElement row = Common.checkTextInCollection(rows, tag);
            row.$("[data-original-title=\"Edit the rule\"]").click();
        } else {
            $("[data-original-title=\"Edit the rule\"]").click();
        }
    }

    public static String createTestRule() {
        Date date = new Date();
        long timestamp = date.getTime();
        String tag = "testTag" + timestamp;
        addNewLinkClick();
        useAllBtnClick();
        selectSource("From", "IP", "10.10.10.10");
        selectSource("To", "Tag", tag);
        createRuleBtn().click();
        return tag;
    }

    public static void checkRuleParametersByTag(String tag, String action, String protocol, String from, String to) {
        ElementsCollection rows = ($$("[data-ng-repeat=\"object in objects | orderBy:order | filter:matchesFilter\"]"));
        SelenideElement row = Common.checkTextInCollection(rows, "tag: " + tag);
        assertTrue(row.getText().contains(System.getProperty("datacenter")));
        assertTrue(row.getText().contains(action));
        assertTrue(row.getText().contains(protocol));
        assertTrue(row.getText().contains(from));
        assertTrue(row.getText().contains(to));
    }
}