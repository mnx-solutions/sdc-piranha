package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import org.openqa.selenium.JavascriptExecutor;

import static com.codeborne.selenide.Condition.exist;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class AccountSSH extends AbstractPageObject {
    public SelenideElement getKeyNameLabel() {
        return $(".accordion-ssh-package-title");
    }

    public ELBApiForm clickELBApi() {
        $(".key-name.ng-binding").click();
        return page(ELBApiForm.class);
    }

    public void deleteTopKey() {
        final SelenideElement keyRepeater = $("[data-ng-repeat=\"key in keys | reverse\"] div span", 0);
        keyRepeater.click();
        $(byText("Delete")).click();
        clickButtonInModal("Yes");
    }

    public static class ELBApiForm extends AbstractPageObject {
        public SelenideElement getFingerprintLabel() {
            return $(byText("Fingerprint"));
        }
    }

    public void clickImportPublicKey() {
        $("[data-ng-click=\"addNewKey()\"]").click();
    }

    public void uploadFile(String absoluteFilePath) {
        $("#uploadInput").waitUntil(exist, baseTimeout);
        JavascriptExecutor javascriptExecutor = (JavascriptExecutor) WebDriverRunner.getWebDriver();
        javascriptExecutor.executeScript("$('#uploadInput')[0].setAttribute('style', '')");
        $("#uploadInput").waitUntil(visible, baseTimeout);
        $("#uploadInput").sendKeys(absoluteFilePath);
    }
}
