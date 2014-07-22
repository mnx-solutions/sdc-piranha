package com.joyent.piranha.pageobject;

import com.codeborne.selenide.Condition;
import com.codeborne.selenide.SelenideElement;
import org.openqa.selenium.By;
import org.openqa.selenium.support.ui.Select;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;

public class FirewallRuleDetails extends AbstractPageObject {

    public enum Target {
        Tag("[data-ng-model=\"current.%s.text\"]"), Instance(), IP("input[name=\"%sValue\"]"), Subnet("input[name=\"%sValue\"]"), AllmyVMsinDC("All my VMs in DC", null);
        private String name;
        private String selectorTemplate;

        Target() {
            this(null);
        }

        Target(String selectorTemplate) {
            this(null, selectorTemplate);
        }

        Target(String name, String selectorTemplate) {
            this.name = name == null ? name() : name;
            this.selectorTemplate = selectorTemplate;
        }

        static Target getTarget(String name) {
            Target[] targets = Target.values();
            Target targetByName = null;
            for (Target target : targets) {
                if (target.name.equals(name)) {
                    targetByName = target;
                    break;
                }
            }
            return targetByName;
        }
    }

    public enum Direction {
        From, To;

        void setTarget(Target target, String value) {
            if (target == Target.Instance) {
                selectInstance(name(), value);
            } else if (target.selectorTemplate != null) {
                SelenideElement inputField = $(String.format(target.selectorTemplate, name().toLowerCase()));
                assert inputField != null;
                inputField.clear();
                inputField.sendKeys(value);
            }
        }

        private void selectInstance(String direction, String instanceName) {
            $("#s2id_" + direction.toLowerCase() + "InstanceSelect a").click();
            $("#select2-drop div input").setValue(instanceName);
        }

    }

    public SelenideElement getCreateRuleButton() {
        return $("[data-ng-click=\"saveRule()\"]");
    }

    public void selectProtocol(String protocolText) {
        Select protocol = new Select($("#protocolSelect"));
        protocol.selectByVisibleText(protocolText);
    }

    public void clickUseAllButton() {
        $("[data-ng-click=\"useAllPorts()\"]").click();
    }

    public void selectTargetValue(String direction, String targetName, String targetValue) {
        selectTarget(direction, targetName);
        Direction.valueOf(direction).setTarget(Target.getTarget(targetName), targetValue);
        getAddButton(direction).click();
        $("[data-ng-repeat=\"" + direction.toLowerCase() + " in data.parsed." + direction.toLowerCase() + "\"] .remove-icon").waitUntil(Condition.visible, baseTimeout);
    }

    public static SelenideElement getAddButton(String section) {
        return $("[data-ng-click=\"add" + section + "()\"]");
    }

    private void selectTarget(String direction, String targetName) {
        String fieldId = "s2id_" + direction.toLowerCase() + "Select";
        SelenideElement element = $("#select2-drop");
        if (!element.isDisplayed()) {
            $(By.id(fieldId)).$(".select2-choice").click();
        }
        element.$(byText(targetName)).click();
    }

    public void removeFirstOption(String optionName) {
        if (optionName.equalsIgnoreCase("protocol")) {
            SelenideElement element = $("[data-ng-repeat=\"target in data.parsed.protocol.targets\"] .remove-icon");
            element.waitUntil(Condition.visible, baseTimeout);
            element.click();
        } else {
            SelenideElement element = $("[data-ng-repeat=\"" + optionName.toLowerCase() + " in data.parsed." + optionName.toLowerCase() + "\"] .remove-icon");
            element.waitUntil(Condition.visible, baseTimeout);
            element.click();
        }
    }

    public SelenideElement getAlert() {
        return $(".modal-body p");
    }

    public void clickCancelCreateButton() {
        $("[data-ng-click=\"cancelRule()\"]").click();
    }

    public void selectDatacenter(String datacenter) {
        Select select = new Select($("#dcSelect"));
        select.selectByVisibleText(datacenter);
    }
}
