package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import org.openqa.selenium.JavascriptExecutor;

import static com.codeborne.selenide.Condition.exist;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;
import static com.codeborne.selenide.Selenide.page;

public class AccountSSH extends AbstractPageObject {
    public SelenideElement getKeyNameLabel() {
        return $(".accordion-ssh-package-title");
    }

    public ELBApiForm clickELBApi() {
        $(".key-name.ng-binding").click();
        return page(ELBApiForm.class);
    }

    public int getNumberOfKeys() {
        $("[data-ng-show=\"loadingKeys\"]").waitWhile(visible, baseTimeout);
        return $$("[data-ng-repeat=\"key in keys | reverse\"]").size();
    }

    public void deleteLastKey() {
        final SelenideElement keyRepeater = $("[data-ng-repeat=\"key in keys | reverse\"]", getNumberOfKeys() - 1);
        keyRepeater.$("div span", 0).click();
        SelenideElement deleteButton = keyRepeater.$(byText("Delete"));
        deleteButton.click();
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
        JavascriptExecutor javascriptExecutor = (JavascriptExecutor) WebDriverRunner.getWebDriver();
        javascriptExecutor.executeScript("$('.modal textarea')[0].setAttribute('rows', '1')");
        $("#uploadInput").waitUntil(exist, baseTimeout);
        javascriptExecutor.executeScript("$('#uploadInput')[0].setAttribute('style', '')");
        $("#uploadInput").waitUntil(visible, baseTimeout);
        $("#uploadInput").sendKeys(absoluteFilePath);
        waitForMediumSpinnerDisappear();
    }
}
